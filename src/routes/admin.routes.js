const express = require("express");

const router = express.Router();

const requireAuth = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");

const adminController = require("../controllers/admin.controllers");

router.use(requireAuth);
router.use(requireRole("admin"));

router.get("/users", adminController.getUsers);

router.post("/users", adminController.createUser);

router.put("/users/:id", adminController.updateUser);

router.patch("/users/:id/status", adminController.updateStatus);

router.patch("/users/:id/password", adminController.resetPassword);

module.exports = router;