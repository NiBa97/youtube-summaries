/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("videos00000videos");

  collection.schema.addField(new SchemaField({
    "id": "vid_transcript",
    "name": "transcript",
    "type": "json",
    "required": false,
    "options": { "maxSize": 5000000 }
  }));

  return dao.saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("videos00000videos");

  collection.schema.removeField("vid_transcript");

  return dao.saveCollection(collection);
});
