/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "videos00000videos",
    "name": "videos",
    "type": "base",
    "system": false,
    "schema": [
      {
        "id": "vid_url",
        "name": "url",
        "type": "url",
        "required": true,
        "options": {
          "exceptDomains": null,
          "onlyDomains": null
        }
      },
      {
        "id": "vid_videoid",
        "name": "video_id",
        "type": "text",
        "required": true,
        "options": {
          "min": 11,
          "max": 11,
          "pattern": "^[A-Za-z0-9_-]{11}$"
        }
      },
      {
        "id": "vid_title",
        "name": "title",
        "type": "text",
        "required": false,
        "options": { "max": 500 }
      },
      {
        "id": "vid_status",
        "name": "status",
        "type": "select",
        "required": true,
        "options": {
          "maxSelect": 1,
          "values": ["pending", "transcribed", "slides_ready", "error"]
        }
      },
      {
        "id": "vid_slides",
        "name": "slides_html",
        "type": "text",
        "required": false,
        "options": {}
      },
      {
        "id": "vid_error",
        "name": "error",
        "type": "text",
        "required": false,
        "options": {}
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX `idx_videos_video_id` ON `videos` (`video_id`)"
    ],
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("videos00000videos");
  return dao.deleteCollection(collection);
});
