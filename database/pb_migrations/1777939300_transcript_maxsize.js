/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("videos00000videos");

  const transcript = collection.schema.getFieldByName("transcript");
  transcript.options = { "maxSize": 5000000 };

  return dao.saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("videos00000videos");

  const transcript = collection.schema.getFieldByName("transcript");
  transcript.options = {};

  return dao.saveCollection(collection);
});
