require("dotenv").config();

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const db = require("../config/db");

const gmailPattern = /^[A-Z0-9._%+-]+@gmail\.com$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function seedUsers() {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const studentEmail = process.env.STUDENT_EMAIL?.trim().toLowerCase();

    if (!adminEmail || !gmailPattern.test(adminEmail)) {
        throw new Error("Set ADMIN_EMAIL to a valid administrator Gmail address.");
    }

    if (!studentEmail || !emailPattern.test(studentEmail) || studentEmail.length > 254) {
        throw new Error("Set STUDENT_EMAIL to Vigi's valid student email address.");
    }

    if (adminEmail === studentEmail) {
        throw new Error("The admin and student must use different email addresses.");
    }

    const adminPassword = crypto.randomBytes(24).toString("base64url");
    const studentPassword = crypto.randomBytes(24).toString("base64url");
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [existingUsers] = await connection.execute(
            "SELECT email FROM users WHERE email IN (?, ?) FOR UPDATE",
            [adminEmail, studentEmail]
        );

        if (existingUsers.length > 0) {
            const existingEmail = existingUsers[0].email;
            throw new Error(`An account already uses ${existingEmail}. No accounts were changed.`);
        }

        const [adminPasswordHash, studentPasswordHash] = await Promise.all([
            bcrypt.hash(adminPassword, 12),
            bcrypt.hash(studentPassword, 12),
        ]);

        await connection.execute(
            "INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'admin', 'active')",
            ["Quickrr Admin", adminEmail, adminPasswordHash]
        );
        await connection.execute(
            "INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'student', 'active')",
            ["Vigi", studentEmail, studentPasswordHash]
        );
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    console.log("Created both accounts. Save these temporary passwords now; they are not stored in plain text.");
    console.log(`Admin (${adminEmail}) temporary password: ${adminPassword}`);
    console.log(`Vigi (${studentEmail}) temporary password: ${studentPassword}`);
}

seedUsers()
    .catch((error) => {
        console.error("Could not create the requested accounts:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.end();
    });
