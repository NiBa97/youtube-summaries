/// <reference path="../pb_data/types.d.ts" />
// The sanitised comment list that was actually sent to Gemini, stored for the
// same reason the transcript is - and with a stronger case. A transcript
// re-fetch is idempotent; a comment re-scrape is not, because new comments
// arrive, vote counts move, and comments get deleted. Without this the deck's
// community section cannot be reproduced, and a bad section cannot be
// attributed to a bad scrape rather than a bad model.
migrate((db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("videos00000videos");

  collection.schema.addField(new SchemaField({
    "id": "vid_comm",
    "name": "comments",
    "type": "json",
    "required": false,
    "options": { "maxSize": 100000 }
  }));

  return dao.saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("videos00000videos");

  collection.schema.removeField("vid_comm");

  return dao.saveCollection(collection);
});
