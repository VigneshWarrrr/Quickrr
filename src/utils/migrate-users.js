require("dotenv").config();

const db = require("../config/db");

const userTableColumns = {
    staff_id: "ALTER TABLE users ADD COLUMN staff_id VARCHAR(64) NULL",
    phone: "ALTER TABLE users ADD COLUMN phone VARCHAR(32) NULL",
    theme: "ALTER TABLE users ADD COLUMN theme ENUM('light', 'dark') NOT NULL DEFAULT 'light'",
    updated_at: "ALTER TABLE users ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
};

async function migrateUsers() {
    const [tables] = await db.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
    );

    if (tables.length === 0) {
        throw new Error("The users table does not exist. Apply database/schema.sql first.");
    }

    const [existingColumns] = await db.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
    );
    const columnNames = new Set(existingColumns.map((column) => column.COLUMN_NAME));

    for (const [columnName, migrationSql] of Object.entries(userTableColumns)) {
        if (!columnNames.has(columnName)) {
            await db.execute(migrationSql);
            console.log(`Added users.${columnName}.`);
        }
    }

    if (columnNames.has("student_id")) {
        const [studentIdIndexes] = await db.execute(
            "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'users_student_id_unique'"
        );
        if (studentIdIndexes.length > 0) {
            await db.execute("ALTER TABLE users DROP INDEX users_student_id_unique");
        }
        await db.execute("ALTER TABLE users DROP COLUMN student_id");
        console.log("Removed users.student_id.");
    }

    const [staffIdIndexes] = await db.execute(
        "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'users_staff_id_unique'"
    );

    if (staffIdIndexes.length === 0) {
        await db.execute("ALTER TABLE users ADD UNIQUE KEY users_staff_id_unique (staff_id)");
        console.log("Added unique users.staff_id index.");
    }

    console.log("User table migration completed. Account rows were preserved.");
}

migrateUsers()
    .catch((error) => {
        console.error("Could not migrate the users table:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.end();
    });
