require("dotenv").config();

const bcrypt = require("bcrypt");
const db = require("../config/db");

const gmailPattern = /^[A-Z0-9._%+-]+@gmail\.com$/i;

async function createAdmin() {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME?.trim() || "Quickrr Admin";

    if (!email || !gmailPattern.test(email)) {
        throw new Error("Set ADMIN_EMAIL to a valid Gmail address for this one-time command.");
    }

    if (!password || password.length < 12 || password.length > 200) {
        throw new Error("Set ADMIN_PASSWORD to a password between 12 and 200 characters.");
    }

    if (name.length === 0 || name.length > 100) {
        throw new Error("ADMIN_NAME must be between 1 and 100 characters.");
    }

    const [existingAdmins] = await db.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);

    if (existingAdmins.length > 0) {
        throw new Error("An account already uses this Gmail address. No account was changed.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.execute(
        "INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'admin', 'active')",
        [name, email, passwordHash]
    );

    console.log(`Administrator account created for ${email}.`);
}

createAdmin()
    .catch((error) => {
        console.error("Could not create administrator account:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.end();
    });
