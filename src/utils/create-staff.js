require("dotenv").config();

const bcrypt = require("bcrypt");
const db = require("../config/db");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const staffIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

async function createStaff() {
    const staffId = process.env.STAFF_ID?.trim().toUpperCase();
    const email = process.env.STAFF_EMAIL?.trim().toLowerCase();
    const password = process.env.STAFF_PASSWORD;
    const name = process.env.STAFF_NAME?.trim();

    if (!staffId || !staffIdPattern.test(staffId)) {
        throw new Error("Set STAFF_ID to a value of 1–64 letters, numbers, hyphens, or underscores.");
    }

    if (!email || !emailPattern.test(email) || email.length > 254) {
        throw new Error("Set STAFF_EMAIL to a valid contact email address.");
    }

    if (!password || password.length < 12 || password.length > 200) {
        throw new Error("Set STAFF_PASSWORD to a password between 12 and 200 characters.");
    }

    if (!name || name.length > 100) {
        throw new Error("Set STAFF_NAME to a name between 1 and 100 characters.");
    }

    const [existingAccounts] = await db.execute(
        "SELECT id FROM users WHERE staff_id = ? OR email = ? LIMIT 1",
        [staffId, email]
    );

    if (existingAccounts.length > 0) {
        throw new Error("That staff ID or email address is already in use. No account was changed.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.execute(
        "INSERT INTO users (name, email, staff_id, password_hash, role, status) VALUES (?, ?, ?, ?, 'staff', 'active')",
        [name, email, staffId, passwordHash]
    );

    console.log(`Staff account created for ${name} (ID: ${staffId}). Sign in with this ID or the account email.`);
}

createStaff()
    .catch((error) => {
        console.error("Could not create staff account:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.end();
    });
