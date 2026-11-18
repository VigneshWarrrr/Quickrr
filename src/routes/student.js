const crypto = require("crypto");
const express = require("express");

const db = require("../config/db");

const router = express.Router();
const maxOrderItems = 30;
const maxQuantityPerItem = 20;

router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

async function requireStudent(req, res, next) {
    if (!req.session?.studentId || req.session.userRole !== "student") {
        return res.status(401).json({ error: "Student sign-in is required." });
    }

    const [students] = await db.execute(
        "SELECT id FROM users WHERE id = ? AND role = 'student' AND status = 'active' LIMIT 1",
        [req.session.studentId]
    );

    if (students.length === 0) {
        return req.session.destroy((error) => {
            if (error) {
                return next(error);
            }

            res.clearCookie("quickrr.sid");
            res.status(401).json({ error: "Student sign-in is required." });
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

router.get("/menu", requireStudent, async (req, res) => {
    const [items] = await db.execute(
        `SELECT id, name, description, price, category, image_url AS imageUrl
         FROM menu_items
         WHERE is_available = 1
         ORDER BY category, name, id`
    );

    res.json({ items });
});

router.get("/orders", requireStudent, async (req, res) => {
    const [orders] = await db.execute(
        `SELECT id, order_number AS orderNumber, total_amount AS totalAmount, status, created_at AS createdAt
         FROM orders
         WHERE user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 20`,
        [req.session.studentId]
    );

    const orderIds = orders.map((order) => order.id);
    let itemsByOrder = new Map();

    if (orderIds.length > 0) {
        const placeholders = orderIds.map(() => "?").join(", ");
        const [items] = await db.execute(
            `SELECT oi.order_id AS orderId, mi.name, oi.quantity, oi.subtotal
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
        })),
    });
});

router.post("/orders", requireStudent, requireCsrf, async (req, res) => {
    const submittedItems = req.body?.items;

    if (!Array.isArray(submittedItems) || submittedItems.length === 0 || submittedItems.length > maxOrderItems) {
        return res.status(400).json({ error: `Choose between 1 and ${maxOrderItems} menu items.` });
    }

    const quantities = new Map();

    for (const item of submittedItems) {
        if (!item || !Number.isSafeInteger(item.id) || item.id < 1
            || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > maxQuantityPerItem) {
            return res.status(400).json({ error: "Each cart item needs a valid menu item and quantity." });
        }

        const quantity = (quantities.get(item.id) || 0) + item.quantity;
        if (quantity > maxQuantityPerItem) {
            return res.status(400).json({ error: `An item cannot exceed ${maxQuantityPerItem} per order.` });
        }
        quantities.set(item.id, quantity);
    }

    const connection = await db.getConnection();
    let order;

    try {
        await connection.beginTransaction();
        const itemIds = [...quantities.keys()];
        const placeholders = itemIds.map(() => "?").join(", ");
        const [menuItems] = await connection.execute(
            `SELECT id, name, price
             FROM menu_items
             WHERE is_available = 1 AND id IN (${placeholders})
             FOR UPDATE`,
            itemIds
        );

        if (menuItems.length !== itemIds.length) {
            await connection.rollback();
            return res.status(409).json({ error: "One or more items are no longer available. Refresh the menu and try again." });
        }

        const itemsWithPrices = menuItems.map((menuItem) => {
            const unitPriceCents = Math.round(Number(menuItem.price) * 100);
            const quantity = quantities.get(menuItem.id);
            return {
                id: menuItem.id,
                name: menuItem.name,
                quantity,
                unitPriceCents,
                subtotalCents: unitPriceCents * quantity,
            };
        });
        const totalCents = itemsWithPrices.reduce((total, item) => total + item.subtotalCents, 0);

        if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
            await connection.rollback();
            return res.status(400).json({ error: "The order total is invalid." });
        }

        const orderNumber = `Q${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
        const [result] = await connection.execute(
            `INSERT INTO orders (order_number, user_id, total_amount, status)
             VALUES (?, ?, ?, 'Pending')`,
            [orderNumber, req.session.studentId, (totalCents / 100).toFixed(2)]
        );

        for (const item of itemsWithPrices) {
            await connection.execute(
                `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, subtotal)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    result.insertId,
                    item.id,
                    item.quantity,
                    (item.unitPriceCents / 100).toFixed(2),
                    (item.subtotalCents / 100).toFixed(2),
                ]
            );
        }

        await connection.commit();
        order = {
            id: result.insertId,
            orderNumber,
            totalAmount: (totalCents / 100).toFixed(2),
            status: "Pending",
            items: itemsWithPrices.map((item) => ({
                name: item.name,
                quantity: item.quantity,
                subtotal: (item.subtotalCents / 100).toFixed(2),
            })),
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    res.status(201).json({ order });
});

module.exports = router;
