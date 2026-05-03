/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("videos00000videos");

  const slides = collection.schema.getFieldByName("slides_html");
  slides.type = "editor";
  slides.options = {};

  return dao.saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("videos00000videos");

  const slides = collection.schema.getFieldByName("slides_html");
  slides.type = "text";
  slides.options = {};

  return dao.saveCollection(collection);
});
