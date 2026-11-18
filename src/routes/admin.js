const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcrypt");

const db = require("../config/db");

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedRoles = new Set(["student", "admin", "staff"]);
const staffIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

function getCsrfToken(req) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }

    return req.session.csrfToken;
}

function hasValidCsrfToken(req) {
    const expectedToken = req.session?.csrfToken;
    const suppliedToken = req.get("X-CSRF-Token");

    if (!expectedToken || !suppliedToken || !/^[a-f0-9]{64}$/.test(suppliedToken) || suppliedToken.length !== expectedToken.length) {
        return false;
    }

    return crypto.timingSafeEqual(Buffer.from(expectedToken), Buffer.from(suppliedToken));
}

function requireCsrf(req, res, next) {
    if (!hasValidCsrfToken(req)) {
        return res.status(403).json({ error: "Your session expired. Refresh the page and try again." });
    }

    next();
}

async function requireAdmin(req, res, next) {
    if (!req.session?.adminId) {
        return res.status(401).json({ error: "Administrator sign-in is required." });
    }

    const [admins] = await db.execute(
        "SELECT id, email FROM users WHERE id = ? AND role = 'admin' AND status = 'active' LIMIT 1",
        [req.session.adminId]
    );

    if (admins.length === 0) {
        return req.session.destroy((error) => {
            if (error) {
                return next(error);
            }

            res.clearCookie("quickrr.sid");
            res.status(401).json({ error: "Administrator sign-in is required." });
        });
    }

    req.session.adminEmail = admins[0].email;
    next();
}

function validateProfileUpdate(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return "Submit a valid profile update.";
    }

    const allowedFields = new Set(["name", "email", "staffId", "phone", "status"]);
    const keys = Object.keys(body);

    if (keys.length === 0 || keys.some((key) => !allowedFields.has(key))) {
        return "Choose at least one supported profile field to update.";
    }

    if (Object.hasOwn(body, "name") && (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100)) {
        return "Name is required and must be 100 characters or fewer.";
    }

    if (Object.hasOwn(body, "email") && (typeof body.email !== "string" || !emailPattern.test(body.email.trim()) || body.email.trim().length > 254)) {
        return "Enter a valid email address.";
    }

    if (Object.hasOwn(body, "staffId")
        && (typeof body.staffId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(body.staffId.trim()))) {
        return "Staff ID must start with a letter or number and contain only letters, numbers, hyphens, or underscores.";
    }

    if (Object.hasOwn(body, "phone") && body.phone !== null && (typeof body.phone !== "string" || body.phone.trim().length > 32)) {
        return "Phone number must be 32 characters or fewer.";
    }

    if (Object.hasOwn(body, "status") && !["active", "inactive"].includes(body.status)) {
        return "Choose an active or inactive account status.";
    }

    return null;
}

function mapProfileField(field, value) {
    if (field === "name" || field === "email" || field === "status") {
        return value.trim();
    }

    if (field === "staffId" && value !== null) {
        return value.trim().toUpperCase();
    }

    return value === null || value.trim() === "" ? null : value.trim();
}

router.get("/session", requireAdmin, (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
        admin: { email: req.session.adminEmail },
        csrfToken: getCsrfToken(req),
    });
});

router.post("/logout", requireAdmin, requireCsrf, (req, res, next) => {
    req.session.destroy((error) => {
        if (error) {
            return next(error);
        }

        res.clearCookie("quickrr.sid");
        res.status(204).end();
    });
});

router.get("/users", requireAdmin, async (req, res) => {
    let page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 10);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const role = typeof req.query.role === "string" ? req.query.role : "";

    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        return res.status(400).json({ error: "Invalid pagination values." });
    }

    if (search.length > 100 || !["", "active", "inactive"].includes(status) || !["", "student", "admin", "staff"].includes(role)) {
        return res.status(400).json({ error: "Invalid search, account status, or role filter." });
    }

    const filters = ["1 = 1"];
    const parameters = [];

    if (role) {
        filters.push("role = ?");
        parameters.push(role);
    }

    if (status) {
        filters.push("status = ?");
        parameters.push(status);
    }

    if (search) {
        const searchTerm = `%${search}%`;
        filters.push("(name LIKE ? OR email LIKE ? OR staff_id LIKE ?)");
        parameters.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = filters.join(" AND ");
    const [countRows] = await db.execute(
        `SELECT COUNT(*) AS total FROM users WHERE ${whereClause}`,
        parameters
    );
    const total = Number(countRows[0].total);
    const totalPages = Math.ceil(total / pageSize);
    page = Math.min(page, Math.max(totalPages, 1));
    const offset = (page - 1) * pageSize;
    const [users] = await db.execute(
        `SELECT id, name, email, staff_id AS staffId, phone, role, status, created_at AS createdAt
         FROM users WHERE ${whereClause}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...parameters, pageSize, offset]
    );

    res.set("Cache-Control", "no-store");
    res.json({ users, page, pageSize, total, totalPages });
});

router.post("/users", requireAdmin, requireCsrf, async (req, res) => {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const role = typeof body.role === "string" ? body.role : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const staffId = typeof body.staffId === "string" ? body.staffId.trim().toUpperCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

    if (!allowedRoles.has(role)) {
        return res.status(400).json({ error: "Choose a valid account role." });
    }

    if (!name || name.length > 100 || !emailPattern.test(email) || email.length > 254) {
        return res.status(400).json({ error: "Enter a name and a valid contact email address." });
    }

    if (!password || password.length < 12 || password.length > 200) {
        return res.status(400).json({ error: "The initial password must be between 12 and 200 characters." });
    }

    if (phone.length > 32 || (role === "staff" && !staffIdPattern.test(staffId))) {
        return res.status(400).json({ error: "Check the account ID and phone number values." });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    try {
        const [result] = await db.execute(
            `INSERT INTO users (name, email, staff_id, phone, password_hash, role, status)
             VALUES (?, ?, ?, ?, ?, ?, 'active')`,
            [
                name,
                email,
                role === "staff" ? staffId : null,
                phone || null,
                passwordHash,
                role,
            ]
        );

        res.status(201).json({
            user: {
                id: result.insertId,
                name,
                email,
                staffId: role === "staff" ? staffId : null,
                phone: phone || null,
                role,
                status: "active",
            },
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "That email address or account ID is already in use." });
        }

        throw error;
    }
});

router.patch("/users/:id", requireAdmin, requireCsrf, async (req, res) => {
    if (!/^[1-9]\d{0,19}$/.test(req.params.id) || BigInt(req.params.id) > 18446744073709551615n) {
        return res.status(400).json({ error: "Invalid user ID." });
    }

    const validationError = validateProfileUpdate(req.body);

    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    const fieldToColumn = {
        name: "name",
        email: "email",
        staffId: "staff_id",
        phone: "phone",
        status: "status",
    };
    const assignments = Object.keys(req.body).map((field) => `${fieldToColumn[field]} = ?`);
    const values = Object.entries(req.body).map(([field, value]) => mapProfileField(field, value));

    try {
        const [result] = await db.execute(
            `UPDATE users SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [...values, req.params.id]
        );

        if (result.affectedRows === 0) {
            const [existingUsers] = await db.execute(
                "SELECT id FROM users WHERE id = ? LIMIT 1",
                [req.params.id]
            );

            if (existingUsers.length === 0) {
                return res.status(404).json({ error: "Account not found." });
            }
        }

        const [updatedUsers] = await db.execute(
            `SELECT id, name, email, staff_id AS staffId, phone, role, status, created_at AS createdAt
             FROM users WHERE id = ? LIMIT 1`,
            [req.params.id]
        );

        res.set("Cache-Control", "no-store");
        res.json({ user: updatedUsers[0] });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "That email address or staff ID is already in use." });
        }

        throw error;
    }
});

router.delete("/users/:id", requireAdmin, requireCsrf, async (req, res) => {
    if (!/^[1-9]\d{0,19}$/.test(req.params.id) || BigInt(req.params.id) > 18446744073709551615n) {
        return res.status(400).json({ error: "Invalid user ID." });
    }

    if (String(req.params.id) === String(req.session.adminId)) {
        return res.status(409).json({ error: "You cannot delete the administrator account you are currently using." });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
        const [users] = await connection.execute(
            "SELECT id, role, status FROM users WHERE id = ? FOR UPDATE",
            [req.params.id]
        );

        if (users.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Account not found." });
        }

        if (users[0].role === "admin" && users[0].status === "active") {
            const [admins] = await connection.execute(
                "SELECT id FROM users WHERE role = 'admin' AND status = 'active' FOR UPDATE"
            );

            if (admins.length <= 1) {
                await connection.rollback();
                return res.status(409).json({ error: "The last active administrator account cannot be deleted." });
            }
        }

        const [orders] = await connection.execute(
            "SELECT id FROM orders WHERE user_id = ? LIMIT 1",
            [req.params.id]
        );

        if (orders.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                error: "This account has order history and cannot be permanently deleted. Deactivate it instead to preserve its orders.",
            });
        }

        await connection.execute("DELETE FROM users WHERE id = ?", [req.params.id]);
        await connection.commit();
        res.status(204).end();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

module.exports = router;
