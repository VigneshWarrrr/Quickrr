const crypto = require("crypto");
const express = require("express");

const db = require("../config/db");

const router = express.Router();
const orderStatuses = new Set(["Pending", "Accepted", "Preparing", "Ready", "Collected", "Cancelled"]);
const nextStatus = {
    Pending: "Preparing",
    Accepted: "Preparing",
    Preparing: "Ready",
    Ready: "Collected",
};

router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

async function requireStaffOrAdmin(req, res, next) {
    const role = req.session?.userRole;
    const userId = req.session?.[`${role}Id`];
    if (!["staff", "admin"].includes(role) || !userId) {
        return res.status(401).json({ error: "Staff or administrator sign-in is required." });
    }

    const [staff] = await db.execute(
        "SELECT id FROM users WHERE id = ? AND role = ? AND status = 'active' LIMIT 1",
        [userId, role]
    );

    if (staff.length === 0) {
        return req.session.destroy((error) => {
            if (error) {
                return next(error);
            }

            res.clearCookie("quickrr.sid");
            res.status(401).json({ error: "Staff or administrator sign-in is required." });
        });
    }

    next();
}

function requireCsrf(req, res, next) {
    const expectedToken = req.session?.csrfToken;
    const suppliedToken = req.get("X-CSRF-Token");

    if (!expectedToken || !suppliedToken
        || !/^[a-f0-9]{64}$/.test(expectedToken)
        || !/^[a-f0-9]{64}$/.test(suppliedToken)) {
        return res.status(403).json({ error: "Your session expired. Refresh the page and try again." });
    }

    if (!crypto.timingSafeEqual(Buffer.from(expectedToken), Buffer.from(suppliedToken))) {
        return res.status(403).json({ error: "Your session expired. Refresh the page and try again." });
    }

    next();
}

function validMenuItemId(value) {
    return /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647;
}

function validateMenuItem(body, partial = false) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return "Submit a valid menu item.";
    }

    const allowedFields = new Set(["name", "description", "category", "price", "isAvailable"]);
    const fields = Object.keys(body);
    if (fields.length === 0 || fields.some((field) => !allowedFields.has(field))) {
        return "Choose supported menu item fields.";
    }

    if (!partial || Object.hasOwn(body, "name")) {
        if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
            return "Name is required and must be 100 characters or fewer.";
        }
    }

    if (Object.hasOwn(body, "description")
        && body.description !== null
        && (typeof body.description !== "string" || body.description.trim().length > 1000)) {
        return "Description must be 1000 characters or fewer.";
    }

    if (Object.hasOwn(body, "category")
        && body.category !== null
        && (typeof body.category !== "string" || body.category.trim().length > 50)) {
        return "Category must be 50 characters or fewer.";
    }

    if (!partial || Object.hasOwn(body, "price")) {
        const price = typeof body.price === "number" ? body.price : Number(body.price);
        if (!Number.isFinite(price) || price <= 0 || price > 99999999.99
            || Math.abs(price * 100 - Math.round(price * 100)) > 1e-8) {
            return "Price must be a positive amount with no more than two decimal places.";
        }
    }

    if (Object.hasOwn(body, "isAvailable") && typeof body.isAvailable !== "boolean") {
        return "Availability must be on or off.";
    }

    return null;
}

router.get("/menu", requireStaffOrAdmin, async (req, res) => {
    const [items] = await db.execute(
        `SELECT id, name, description, price, category, is_available AS isAvailable
         FROM menu_items
         ORDER BY is_available DESC, category, name, id`
    );

    res.json({ items });
});

router.post("/menu", requireStaffOrAdmin, requireCsrf, async (req, res) => {
    const validationError = validateMenuItem(req.body);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    const { name, description = null, category = null, price } = req.body;
    const [result] = await db.execute(
        `INSERT INTO menu_items (name, description, category, price, is_available)
         VALUES (?, ?, ?, ?, 1)`,
        [
            name.trim(),
            typeof description === "string" && description.trim() ? description.trim() : null,
            typeof category === "string" && category.trim() ? category.trim() : null,
            Number(price).toFixed(2),
        ]
    );

    res.status(201).json({
        item: {
            id: result.insertId,
            name: name.trim(),
            description: typeof description === "string" && description.trim() ? description.trim() : null,
            category: typeof category === "string" && category.trim() ? category.trim() : null,
            price: Number(price).toFixed(2),
            isAvailable: true,
        },
    });
});

router.patch("/menu/:id", requireStaffOrAdmin, requireCsrf, async (req, res) => {
    if (!validMenuItemId(req.params.id)) {
        return res.status(400).json({ error: "Invalid menu item ID." });
    }

    const validationError = validateMenuItem(req.body, true);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    const columnForField = {
        name: "name",
        description: "description",
        category: "category",
        price: "price",
        isAvailable: "is_available",
    };
    const fields = Object.keys(req.body);
    const assignments = fields.map((field) => `${columnForField[field]} = ?`);
    const values = fields.map((field) => {
        const value = req.body[field];
        if (field === "price") {
            return Number(value).toFixed(2);
        }
        if (field === "name" || field === "category" || field === "description") {
            return typeof value === "string" && value.trim() ? value.trim() : null;
        }
        return value;
    });

    const [result] = await db.execute(
        `UPDATE menu_items SET ${assignments.join(", ")} WHERE id = ?`,
        [...values, req.params.id]
    );

    if (result.affectedRows === 0) {
        const [items] = await db.execute("SELECT id FROM menu_items WHERE id = ? LIMIT 1", [req.params.id]);
        if (items.length === 0) {
            return res.status(404).json({ error: "Menu item not found." });
        }
    }

    const [items] = await db.execute(
        `SELECT id, name, description, price, category, is_available AS isAvailable
         FROM menu_items WHERE id = ? LIMIT 1`,
        [req.params.id]
    );
    res.json({ item: items[0] });
});

router.delete("/menu/:id", requireStaffOrAdmin, requireCsrf, async (req, res) => {
    if (!validMenuItemId(req.params.id)) {
        return res.status(400).json({ error: "Invalid menu item ID." });
    }

    const [result] = await db.execute(
        "UPDATE menu_items SET is_available = 0 WHERE id = ? AND is_available = 1",
        [req.params.id]
    );
    if (result.affectedRows === 0) {
        const [items] = await db.execute("SELECT id FROM menu_items WHERE id = ? LIMIT 1", [req.params.id]);
        if (items.length === 0) {
            return res.status(404).json({ error: "Menu item not found." });
        }
    }

    res.json({ success: true, isAvailable: false });
});

router.get("/orders", requireStaffOrAdmin, async (req, res) => {
    let page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    if (!Number.isSafeInteger(page) || page < 1
        || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100
        || (page - 1) * pageSize > 2147483647) {
        return res.status(400).json({ error: "Invalid pagination values." });
    }

    if ((status && !orderStatuses.has(status)) || search.length > 100) {
        return res.status(400).json({ error: "Invalid order status or search value." });
    }

    const filters = [];
    const parameters = [];

    if (status) {
        filters.push("o.status = ?");
        parameters.push(status);
    }

    if (search) {
        const searchTerm = `%${search}%`;
        filters.push("(o.order_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)");
        parameters.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const [countRows] = await db.execute(
        `SELECT COUNT(*) AS total
         FROM orders o
         JOIN users u ON u.id = o.user_id
         ${whereClause}`,
        parameters
    );
    const total = Number(countRows[0].total);
    const totalPages = Math.ceil(total / pageSize);
    page = Math.min(page, Math.max(totalPages, 1));
    const offset = (page - 1) * pageSize;
    const [orders] = await db.execute(
        `SELECT o.id, o.order_number AS orderNumber, o.user_id AS userId,
                u.name AS customerName, u.email AS customerEmail,
                o.total_amount AS totalAmount, o.status, o.created_at AS createdAt,
                CASE WHEN o.status IN ('Collected', 'Cancelled') THEN NULL ELSE
                    (SELECT COUNT(*) FROM orders earlier
                     WHERE earlier.status IN ('Pending', 'Accepted', 'Preparing', 'Ready')
                       AND (earlier.created_at < o.created_at
                            OR (earlier.created_at = o.created_at AND earlier.id <= o.id)))
                END AS queuePosition
         FROM orders o
         JOIN users u ON u.id = o.user_id
         ${whereClause}
         ORDER BY CASE WHEN o.status IN ('Collected', 'Cancelled') THEN 1 ELSE 0 END,
                  o.created_at ASC, o.id ASC
         LIMIT ? OFFSET ?`,
        [...parameters, pageSize, offset]
    );

    const statusCounts = await db.execute(
        "SELECT status, COUNT(*) AS total FROM orders GROUP BY status"
    );
    const counts = Object.fromEntries(statusCounts[0].map((row) => [row.status, Number(row.total)]));
    const orderIds = orders.map((order) => order.id);
    let itemsByOrder = new Map();

    if (orderIds.length > 0) {
        const placeholders = orderIds.map(() => "?").join(", ");
        const [items] = await db.execute(
            `SELECT oi.order_id AS orderId, mi.name AS name, oi.quantity, oi.unit_price AS unitPrice, oi.subtotal
             FROM order_items oi
             JOIN menu_items mi ON mi.id = oi.menu_item_id
             WHERE oi.order_id IN (${placeholders})
             ORDER BY oi.id`,
            orderIds
        );

        itemsByOrder = items.reduce((groupedItems, item) => {
            const orderItems = groupedItems.get(item.orderId) || [];
            orderItems.push(item);
            groupedItems.set(item.orderId, orderItems);
            return groupedItems;
        }, new Map());
    }

    res.json({
        orders: orders.map((order) => ({
            ...order,
            items: itemsByOrder.get(order.id) || [],
            queuePosition: order.queuePosition === null ? null : Number(order.queuePosition),
        })),
        counts,
        page,
        pageSize,
        total,
        totalPages,
    });
});

router.patch("/orders/:id/status", requireStaffOrAdmin, requireCsrf, async (req, res) => {
    if (!/^[1-9]\d{0,9}$/.test(req.params.id) || Number(req.params.id) > 2147483647) {
        return res.status(400).json({ error: "Invalid order ID." });
    }

    const requestedStatus = req.body?.status;
    if (!["Preparing", "Ready", "Collected"].includes(requestedStatus)) {
        return res.status(400).json({ error: "Choose Preparing, Ready, or Collected as the next status." });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
        const [queue] = await connection.execute(
            `SELECT id, status
             FROM orders
             WHERE status IN ('Pending', 'Accepted', 'Preparing', 'Ready')
             ORDER BY created_at ASC, id ASC
             LIMIT 1
             FOR UPDATE`
        );

        if (queue.length === 0 || String(queue[0].id) !== String(req.params.id)) {
            const [orders] = await connection.execute(
                "SELECT id, status FROM orders WHERE id = ? LIMIT 1",
                [req.params.id]
            );

            await connection.rollback();
            if (orders.length === 0) {
                return res.status(404).json({ error: "Order not found." });
            }

            return res.status(409).json({
                error: `Process the oldest active order first${queue.length ? ` (order ${queue[0].id})` : ""}.`,
            });
        }

        const currentStatus = queue[0].status;
        if (nextStatus[currentStatus] !== requestedStatus) {
            await connection.rollback();
            return res.status(409).json({
                error: `Order ${req.params.id} is ${currentStatus}; its next status must be ${nextStatus[currentStatus] || "unchanged"}.`,
            });
        }

        await connection.execute(
            "UPDATE orders SET status = ? WHERE id = ? AND status = ?",
            [requestedStatus, req.params.id, currentStatus]
        );
        await connection.commit();
        res.json({ success: true, status: requestedStatus });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
});

module.exports = router;
