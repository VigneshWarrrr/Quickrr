require("dotenv").config();

const bcrypt = require("bcrypt");
const db = require("../src/config/db");

async function resetAdminPassword() {

    try {

        const email = process.env.ADMIN_EMAIL;
        const newPassword = process.env.ADMIN_NEW_PASSWORD;

        if (!email || !newPassword) {
            throw new Error("Admin reset credentials missing in .env");
        }

        if (newPassword.length < 12) {
            throw new Error("Password must contain at least 12 characters.");
        }

        // Generate bcrypt hash
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update admin password
        const [result] = await db.execute(
            `UPDATE users
             SET password_hash = ?, status = 'active'
             WHERE email = ? AND role = 'admin'`,
            [hashedPassword, email]
        );

        if (result.affectedRows === 0) {
            throw new Error("Admin account not found.");
        }

        console.log("Admin password updated successfully!");
        console.log("Password securely hashed using bcrypt.");

    } catch (error) {

        console.error("Password reset failed:", error.message);

    } finally {

        await db.end();

    }
}

resetAdminPassword();