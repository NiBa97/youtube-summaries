/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("videos00000videos");

  collection.schema.addField(new SchemaField({
    "id": "vid_instr",
    "name": "instructions",
    "type": "text",
    "required": false,
    "options": { "max": 1000 }
  }));

  return dao.saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("videos00000videos");

  collection.schema.removeField("vid_instr");

  return dao.saveCollection(collection);
});
