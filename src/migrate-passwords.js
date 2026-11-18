require("dotenv").config();

const bcrypt = require("bcrypt");
const db = require("../src/config/db");

async function migratePasswords() {

    try {

        const [users] = await db.execute(
            "SELECT id, password_hash FROM users"
        );

        for (const user of users) {

            const password = user.password_hash;

            // Skip passwords already stored as bcrypt hashes
            if (/^\$2[aby]\$/.test(password)) {
                continue;
            }

            const hashedPassword = await bcrypt.hash(password, 12);

            await db.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                [hashedPassword, user.id]
            );

            console.log(`Migrated user ID: ${user.id}`);
        }

        console.log("Password migration completed.");

    } catch (error) {

        console.error("Migration failed:", error.message);

    } finally {

        await db.end();

    }
}

migratePasswords();