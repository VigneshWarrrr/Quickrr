const db = require("../config/db");
const bcrypt = require("bcrypt");


// GET ALL USERS
exports.getUsers = async (req, res) => {

    try {

        const [users] = await db.execute(
            `SELECT id, name, email, role, status, created_at
             FROM users
             ORDER BY created_at DESC`
        );

        res.json({
            success: true,
            users
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch users."
        });

    }

};


// CREATE USER
exports.createUser = async (req, res) => {

    try {

        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {

            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });

        }

        if (!["student", "staff"].includes(role)) {

            return res.status(400).json({
                success: false,
                message: "Admin can only create student or staff accounts."
            });

        }

        if (password.length < 12) {

            return res.status(400).json({
                success: false,
                message: "Password must contain at least 12 characters."
            });

        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await db.execute(
            `INSERT INTO users
             (name, email, password_hash, role, status)
             VALUES (?, ?, ?, ?, 'active')`,
            [name.trim(), email.trim().toLowerCase(), hashedPassword, role]
        );

        res.status(201).json({
            success: true,
            message: "User created successfully."
        });

    } catch (error) {

        if (error.code === "ER_DUP_ENTRY") {

            return res.status(409).json({
                success: false,
                message: "Email already exists."
            });

        }

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to create user."
        });

    }

};


// UPDATE USER
exports.updateUser = async (req, res) => {

    try {

        const { id } = req.params;
        const { name, email, role } = req.body;

        if (!name || !email || !["student", "staff"].includes(role)) {

            return res.status(400).json({
                success: false,
                message: "Invalid user details."
            });

        }

        const [result] = await db.execute(
            `UPDATE users
             SET name = ?, email = ?, role = ?
             WHERE id = ? AND role IN ('student', 'staff')`,
            [name.trim(), email.trim().toLowerCase(), role, id]
        );

        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "User not found or cannot be modified."
            });

        }

        res.json({
            success: true,
            message: "User updated successfully."
        });

    } catch (error) {

        if (error.code === "ER_DUP_ENTRY") {

            return res.status(409).json({
                success: false,
                message: "Email already exists."
            });

        }

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to update user."
        });

    }

};


// CHANGE USER STATUS
exports.updateStatus = async (req, res) => {

    try {

        const { id } = req.params;
        const { status } = req.body;

        if (!["active", "inactive", "suspended"].includes(status)) {

            return res.status(400).json({
                success: false,
                message: "Invalid account status."
            });

        }

        const [result] = await db.execute(
            `UPDATE users
             SET status = ?
             WHERE id = ?
             AND role IN ('student', 'staff')`,
            [status, id]
        );

        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "User not found."
            });

        }

        res.json({
            success: true,
            message: "Account status updated."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to update status."
        });

    }

};


// RESET USER PASSWORD
exports.resetPassword = async (req, res) => {

    try {

        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 12) {

            return res.status(400).json({
                success: false,
                message: "Password must contain at least 12 characters."
            });

        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        const [result] = await db.execute(
            `UPDATE users
             SET password_hash = ?
             WHERE id = ?
             AND role IN ('student', 'staff')`,
            [hashedPassword, id]
        );

        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "User not found."
            });

        }

        res.json({
            success: true,
            message: "Password reset successfully."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to reset password."
        });

    }

};