/// <reference path="../pb_data/types.d.ts" />
// Re-applies hardcoded admin password (PB only runs each migration file once).
// Bump filename timestamp again if password changes.

migrate((db) => {
  const dao = new Dao(db);
  const email = "admin@yts.local";
  const password = "admin123";

  let admin;
  try {
    admin = dao.findAdminByEmail(email);
  } catch (_) {
    admin = new Admin();
    admin.email = email;
  }
  admin.setPassword(password);
  dao.saveAdmin(admin);
}, (db) => {});
