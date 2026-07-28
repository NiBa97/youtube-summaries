"""File the videos that are already in the library, in two steps.

    uv run python scripts/backfill_tags.py                   # classify -> JSON file
    $EDITOR backfill_proposal.json                           # <- you review it
    uv run python scripts/backfill_tags.py --apply           # write to Pocketbase
    uv run python scripts/backfill_tags.py --revert          # undo every ai tag

Everything this script writes is recorded in `tag_source` as "ai", which is what
makes --revert possible: it strips exactly the tags this script attached and
leaves anything you filed by hand alone.

By default only tags that already exist in the vocabulary are applied. Proposed
new tags are written into the JSON under "new_tags" for you to look at, but are
not created - a backfill run over a whole library is the single easiest way to
double the size of a tag vocabulary by accident. Pass --allow-new to create them.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.gemini import classify_video  # noqa: E402
from app.main import Classification, Vocabulary, VocabularyTag, _reconcile  # noqa: E402
from scripts import pblib  # noqa: E402

DEFAULT_FILE = "backfill_proposal.json"
AUTO_APPLY_THRESHOLD = 0.75


def load_vocabulary() -> tuple[Vocabulary, dict[str, dict]]:
    tags = pblib.get_full_list("tags", {"fields": "id,name,norm,kind"})
    videos = pblib.get_full_list("videos", {"fields": "id,tags"})
    counts: dict[str, int] = {}
    for v in videos:
        for tag_id in v.get("tags") or []:
            counts[tag_id] = counts.get(tag_id, 0) + 1

    vocab = Vocabulary(
        topics=[t["name"] for t in tags if t.get("kind") == "topic"],
        tags=sorted(
            (VocabularyTag(name=t["name"], count=counts.get(t["id"], 0)) for t in tags if t.get("kind") == "tag"),
            key=lambda t: (-t.count, t.name),
        ),
    )
    return vocab, {t["norm"]: t for t in tags}


def do_propose(path: str, only_unfiled: bool, limit: int | None) -> int:
    vocab, _ = load_vocabulary()
    if not vocab.topics and not vocab.tags:
        print("The vocabulary is empty - run scripts/seed_vocabulary.py first.")
        return 1

    videos = pblib.get_full_list("videos", {"fields": "id,title,deck,topic,tags", "sort": "-created"})
    if only_unfiled:
        videos = [v for v in videos if not v.get("topic") and not (v.get("tags") or [])]
    if limit:
        videos = videos[:limit]
    if not videos:
        print("Nothing to classify.")
        return 0

    print(f"Classifying {len(videos)} videos against {len(vocab.topics)} topics / {len(vocab.tags)} tags…")
    proposals = []
    for index, record in enumerate(videos, 1):
        title, tldr, body = pblib.video_text(record)
        try:
            raw = classify_video(
                title=title,
                tldr=tldr,
                body=body,
                topics=vocab.topics,
                tags=[(t.name, t.count) for t in vocab.tags],
            )
            result: Classification = _reconcile(raw, vocab)
        except Exception as exc:  # noqa: BLE001
            print(f"  [{index}/{len(videos)}] {title[:50]} -> FAILED: {exc}")
            continue

        applied = [s.name for s in result.tags if s.confidence >= AUTO_APPLY_THRESHOLD]
        proposals.append({
            "id": record["id"],
            "title": title,
            "topic": result.topic,
            "topic_confidence": round(result.topic_confidence, 2),
            "tags": applied,
            "low_confidence_tags": [
                {"name": s.name, "confidence": round(s.confidence, 2)}
                for s in result.tags
                if s.confidence < AUTO_APPLY_THRESHOLD
            ],
            "new_tags": [{"name": s.name, "confidence": round(s.confidence, 2)} for s in result.new_tags],
        })
        print(f"  [{index}/{len(videos)}] {title[:50]:<50} {result.topic or '-':<12} {', '.join(applied)}")

    with open(path, "w") as fh:
        json.dump({"videos": proposals}, fh, indent=2, ensure_ascii=False)

    new_names = sorted({t["name"] for p in proposals for t in p["new_tags"]})
    print(f"\nWritten to {path}. Nothing has been written to Pocketbase.")
    print("Move anything you want from low_confidence_tags / new_tags up into tags before applying.")
    if new_names:
        print(f"{len(new_names)} proposed new tags (not created unless you pass --allow-new): {', '.join(new_names)}")
    return 0


def do_apply(path: str, allow_new: bool) -> int:
    if not os.path.exists(path):
        print(f"{path} not found - run without --apply first.")
        return 1
    with open(path) as fh:
        proposals = json.load(fh).get("videos") or []

    _, by_norm = load_vocabulary()
    topics_by_norm = {n: t for n, t in by_norm.items() if t.get("kind") == "topic"}

    changed = 0
    for proposal in proposals:
        record = pblib.get_full_list("videos", {"filter": f'id="{proposal["id"]}"'})
        if not record:
            print(f"  skip {proposal['title'][:50]} (record gone)")
            continue
        current = record[0]

        tag_ids: list[str] = list(current.get("tags") or [])
        source = current.get("tag_source") if isinstance(current.get("tag_source"), dict) else {}
        source = dict(source)

        for name in proposal.get("tags") or []:
            norm = pblib.normalize_tag(name)
            hit = by_norm.get(norm)
            if not hit:
                if not allow_new:
                    print(f"  - {name}: not in vocabulary, skipped (use --allow-new to create)")
                    continue
                hit = pblib.create("tags", {"name": name.lower(), "norm": norm, "kind": "tag", "color": "", "sort": 0})
                by_norm[norm] = hit
                print(f"  + created tag {name}")
            if hit["id"] not in tag_ids:
                tag_ids.append(hit["id"])
            source.setdefault(hit["id"], "ai")

        body: dict[str, object] = {"tags": tag_ids, "tag_source": source}

        topic_name = proposal.get("topic")
        if topic_name and not current.get("topic"):
            topic = topics_by_norm.get(pblib.normalize_tag(topic_name))
            if topic:
                body["topic"] = topic["id"]
                source.setdefault(topic["id"], "ai")
            else:
                print(f"  - topic {topic_name!r} is not a topic in the vocabulary, skipped")

        pblib.update("videos", proposal["id"], body)
        changed += 1
        print(f"  ✓ {proposal['title'][:60]}")

    print(f"\n{changed} videos updated. Everything written is marked source=ai; --revert undoes exactly this.")
    return 0


def do_revert() -> int:
    videos = pblib.get_full_list("videos", {"fields": "id,title,topic,tags,tag_source"})
    reverted = 0
    for record in videos:
        source = record.get("tag_source") if isinstance(record.get("tag_source"), dict) else {}
        if not source:
            continue
        ai_ids = {tag_id for tag_id, who in source.items() if who == "ai"}
        if not ai_ids:
            continue
        kept = [t for t in (record.get("tags") or []) if t not in ai_ids]
        body: dict[str, object] = {
            "tags": kept,
            "tag_source": {k: v for k, v in source.items() if v != "ai"},
        }
        if record.get("topic") in ai_ids:
            body["topic"] = ""
        pblib.update("videos", record["id"], body)
        reverted += 1
        print(f"  ✓ {str(record.get('title'))[:60]}")

    print(f"\n{reverted} videos reverted to their human-attached tags only.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write the reviewed proposal to Pocketbase")
    parser.add_argument("--revert", action="store_true", help="strip every tag this script attached")
    parser.add_argument("--allow-new", action="store_true", help="create tags that are not in the vocabulary yet")
    parser.add_argument("--all", action="store_true", help="also re-classify videos that are already filed")
    parser.add_argument("--limit", type=int, default=None, help="classify at most N videos (try a small run first)")
    parser.add_argument("--file", default=DEFAULT_FILE, help=f"proposal file (default: {DEFAULT_FILE})")
    args = parser.parse_args()

    pblib.load_dotenv()
    if args.revert:
        return do_revert()
    if args.apply:
        return do_apply(args.file, args.allow_new)
    return do_propose(args.file, only_unfiled=not args.all, limit=args.limit)


if __name__ == "__main__":
    raise SystemExit(main())
