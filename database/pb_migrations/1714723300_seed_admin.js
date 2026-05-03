/// <reference path="../pb_data/types.d.ts" />
// Hardcoded superuser. Single-user system, no auth elsewhere.
// Email:    admin@yts.local
// Password: admin123

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
}, (db) => {
  const dao = new Dao(db);
  try {
    const admin = dao.findAdminByEmail("admin@yts.local");
    dao.deleteAdmin(admin);
  } catch (_) { }
});
