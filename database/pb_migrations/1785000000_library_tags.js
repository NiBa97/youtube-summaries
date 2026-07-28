/// <reference path="../pb_data/types.d.ts" />
// Library management (option 04): two-tier Topics + tags.
//
// One `tags` collection holds both tiers, discriminated by `kind`:
//   kind = "topic"  -> the ~5-9 mutually-exclusive shelves shown at the top of the rail
//   kind = "tag"    -> the many-per-video facets shown below, scoped to the active topic
// A single table means promoting a tag to a Topic is a `kind` flip, not a data move.
//
// `norm` is the collapsed identity key (lowercased, spaces/-/_ stripped) and is
// unique, so "Machine Learning" / "machine-learning" / "machine_learning" cannot
// coexist as three separate tags.
migrate((db) => {
  const dao = new Dao(db);

  const tags = new Collection({
    "id": "tags00000000tags",
    "name": "tags",
    "type": "base",
    "system": false,
    "schema": [
      {
        "id": "tag_name",
        "name": "name",
        "type": "text",
        "required": true,
        "options": { "min": 1, "max": 60, "pattern": "" }
      },
      {
        "id": "tag_norm",
        "name": "norm",
        "type": "text",
        "required": true,
        "options": { "min": 1, "max": 60, "pattern": "" }
      },
      {
        "id": "tag_kind",
        "name": "kind",
        "type": "select",
        "required": true,
        "options": { "maxSelect": 1, "values": ["topic", "tag"] }
      },
      {
        "id": "tag_color",
        "name": "color",
        "type": "text",
        "required": false,
        "options": { "max": 20, "pattern": "" }
      },
      {
        "id": "tag_sort",
        "name": "sort",
        "type": "number",
        "required": false,
        "options": { "min": null, "max": null, "noDecimal": true }
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX `idx_tags_norm` ON `tags` (`norm`)",
      "CREATE INDEX `idx_tags_kind` ON `tags` (`kind`)"
    ],
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "options": {}
  });

  dao.saveCollection(tags);

  const videos = dao.findCollectionByNameOrId("videos00000videos");

  videos.schema.addField(new SchemaField({
    "id": "vid_topic",
    "name": "topic",
    "type": "relation",
    "required": false,
    "options": {
      "collectionId": "tags00000000tags",
      "cascadeDelete": false,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": null
    }
  }));

  videos.schema.addField(new SchemaField({
    "id": "vid_tags",
    "name": "tags",
    "type": "relation",
    "required": false,
    "options": {
      "collectionId": "tags00000000tags",
      "cascadeDelete": false,
      "minSelect": null,
      "maxSelect": 24,
      "displayFields": null
    }
  }));

  // { "<tag record id>": "ai" | "human" } — provenance, so an auto-tagging run
  // that goes wrong is one bulk revert away.
  videos.schema.addField(new SchemaField({
    "id": "vid_tagsrc",
    "name": "tag_source",
    "type": "json",
    "required": false,
    "options": { "maxSize": 20000 }
  }));

  // Reading state. Distinct from `status`, which is the ingest pipeline state.
  videos.schema.addField(new SchemaField({
    "id": "vid_readst",
    "name": "read_status",
    "type": "select",
    "required": false,
    "options": { "maxSelect": 1, "values": ["unread", "reading", "read"] }
  }));

  videos.schema.addField(new SchemaField({
    "id": "vid_star",
    "name": "starred",
    "type": "bool",
    "required": false,
    "options": {}
  }));

  return dao.saveCollection(videos);
}, (db) => {
  const dao = new Dao(db);

  const videos = dao.findCollectionByNameOrId("videos00000videos");
  videos.schema.removeField("vid_topic");
  videos.schema.removeField("vid_tags");
  videos.schema.removeField("vid_tagsrc");
  videos.schema.removeField("vid_readst");
  videos.schema.removeField("vid_star");
  dao.saveCollection(videos);

  return dao.deleteCollection(dao.findCollectionByNameOrId("tags00000000tags"));
});
