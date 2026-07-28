"""Propose the library's starting vocabulary, then create it - in two steps.

    uv run python scripts/seed_vocabulary.py                 # propose -> JSON file
    $EDITOR vocabulary_proposal.json                         # <- you edit it
    uv run python scripts/seed_vocabulary.py --apply         # write to Pocketbase

Nothing is written to the database by the proposal step. The point of the split
is that the topic list shapes everything downstream - the classifier can never
invent a topic, so a bad topic list is a bad library - and it is much cheaper to
fix a JSON file than to re-file 200 videos.

Re-running --apply is safe: anything whose normalised name already exists is
skipped, so you can edit and re-apply.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.gemini import propose_vocabulary  # noqa: E402
from scripts import pblib  # noqa: E402

DEFAULT_FILE = "vocabulary_proposal.json"

TOPIC_COLORS = [
    "#a85a2a", "#3f6b46", "#8a6a1f", "#2e6f8e",
    "#6a4a8a", "#9a3b2f", "#4a7a7a", "#7a5a3a",
]


def do_propose(path: str) -> int:
    videos = pblib.get_full_list("videos", {"fields": "id,title,deck", "sort": "-created"})
    if not videos:
        print("No videos in the library yet - nothing to propose from.")
        return 1

    lines = []
    for record in videos:
        title, tldr, _ = pblib.video_text(record)
        lines.append(f"- {title}\n  {tldr}")
    corpus = f"{len(videos)} videos:\n\n" + "\n".join(lines)

    print(f"Proposing a vocabulary from {len(videos)} videos…")
    proposal = propose_vocabulary(corpus=corpus)

    with open(path, "w") as fh:
        json.dump(proposal, fh, indent=2, ensure_ascii=False)

    for kind in ("topics", "tags"):
        items = proposal.get(kind) or []
        print(f"\n{kind.upper()} ({len(items)})")
        for item in items:
            print(f"  {item.get('name'):<22} {item.get('rationale', '')}")

    print(f"\nWritten to {path}. Edit it, then re-run with --apply.")
    print("Nothing has been written to Pocketbase.")
    return 0


def do_apply(path: str) -> int:
    if not os.path.exists(path):
        print(f"{path} not found - run without --apply first.")
        return 1
    with open(path) as fh:
        proposal = json.load(fh)

    existing = {t["norm"]: t for t in pblib.get_full_list("tags", {"fields": "id,name,norm,kind"})}
    created = skipped = 0

    for index, item in enumerate(proposal.get("topics") or []):
        name = str(item.get("name", "")).strip()
        norm = pblib.normalize_tag(name)
        if not norm:
            continue
        if norm in existing:
            print(f"  skip topic {name} (already exists as {existing[norm]['name']})")
            skipped += 1
            continue
        pblib.create("tags", {
            "name": name,
            "norm": norm,
            "kind": "topic",
            "color": TOPIC_COLORS[index % len(TOPIC_COLORS)],
            "sort": index,
        })
        print(f"  + topic {name}")
        created += 1

    for item in proposal.get("tags") or []:
        name = str(item.get("name", "")).strip().lower()
        norm = pblib.normalize_tag(name)
        if not norm:
            continue
        if norm in existing:
            print(f"  skip tag {name} (already exists as {existing[norm]['name']})")
            skipped += 1
            continue
        pblib.create("tags", {"name": name, "norm": norm, "kind": "tag", "color": "", "sort": 0})
        print(f"  + tag {name}")
        created += 1

    print(f"\n{created} created, {skipped} skipped. Next: scripts/backfill_tags.py")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write the reviewed proposal to Pocketbase")
    parser.add_argument("--file", default=DEFAULT_FILE, help=f"proposal file (default: {DEFAULT_FILE})")
    args = parser.parse_args()

    pblib.load_dotenv()
    return do_apply(args.file) if args.apply else do_propose(args.file)


if __name__ == "__main__":
    raise SystemExit(main())
