require("dotenv").config();

const db = require("../config/db");

const menuItems = [
    ["Campus Special Burger", "A signature campus burger, made fresh to order.", "Snacks", "149.00"],
    ["Paneer Tikka Wrap", "A flavour-packed paneer tikka wrap.", "Meals", "129.00"],
    ["Loaded Masala Fries", "Crispy fries tossed with campus-style masala.", "Snacks", "89.00"],
    ["Cold Coffee Cloud", "A cool coffee pick-me-up for your break.", "Drinks", "99.00"],
    ["Chocolate Fudge Brownie", "A rich chocolate brownie for something sweet.", "Desserts", "79.00"],
    ["Classic Veg Rice Bowl", "A wholesome, hearty vegetable rice bowl.", "Meals", "139.00"],
];

async function seedMenu() {
    const connection = await db.getConnection();
    let inserted = 0;

    try {
        await connection.beginTransaction();

        for (const [name, description, category, price] of menuItems) {
            const [existingItems] = await connection.execute(
                "SELECT id FROM menu_items WHERE name = ? LIMIT 1 FOR UPDATE",
                [name]
            );

            if (existingItems.length > 0) {
                continue;
            }

            await connection.execute(
                `INSERT INTO menu_items (name, description, category, price, is_available)
                 VALUES (?, ?, ?, ?, 1)`,
                [name, description, category, price]
            );
            inserted += 1;
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    console.log(`Menu setup complete. Added ${inserted} sample items; existing items were left unchanged.`);
}

seedMenu()
    .catch((error) => {
        console.error("Could not seed the sample menu:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.end();
    });
