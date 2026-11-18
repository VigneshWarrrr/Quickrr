const express = require("express");
const path = require("path");

const db = require("./config/db");
const sessionMiddleware = require("./config/sessions");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const staffRoutes = require("./routes/staff");
const studentRoutes = require("./routes/student");

const app = express();
const publicDirectory = path.join(__dirname, "../public");
const allowedRoles = new Set(["student", "admin", "staff"]);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

app.get("/", (req, res) => {
    res.redirect(302, "/login.html");
});

app.get("/admin-login.html", (req, res) => {
    res.redirect(302, "/login.html?role=admin");
});

function requirePageRole(requiredRole) {
    return async (req, res, next) => {
        const role = req.session?.userRole;
        const userId = req.session?.[`${role}Id`];

        if (!allowedRoles.has(role) || !userId) {
            return res.redirect(302, "/login.html");
        }

        try {
            const [users] = await db.execute(
                "SELECT id FROM users WHERE id = ? AND role = ? AND status = 'active' LIMIT 1",
                [userId, role]
            );

            if (users.length === 0) {
                return req.session.destroy((error) => {
                    if (error) {
                        return next(error);
                    }

                    res.clearCookie("quickrr.sid");
                    res.redirect(302, "/login.html");
                });
            }

            const hasRequiredRole = role === requiredRole
                || (requiredRole === "staff" && role === "admin");
            if (requiredRole && !hasRequiredRole) {
                const rolePages = {
                    student: "/index.html",
                    admin: "/admin.html",
                    staff: "/staff.html",
                };
                return res.redirect(302, rolePages[role]);
            }

            res.sendFile(path.join(publicDirectory, req.path.slice(1)), (error) => {
                if (error) {
                    next(error);
                }
            });
        } catch (error) {
            next(error);
        }
    };
}

app.get("/login.html", (req, res, next) => {
    res.sendFile(path.join(publicDirectory, "login.html"), (error) => {
        if (error) {
            next(error);
        }
    });
});

app.get("/index.html", requirePageRole("student"));
app.get("/admin.html", requirePageRole("admin"));
app.get("/staff.html", requirePageRole("staff"));
app.get("/staff-menu.html", requirePageRole("staff"));
app.get("/settings.html", requirePageRole(null));

app.use("/css", express.static(path.join(publicDirectory, "css")));
app.use("/js", express.static(path.join(publicDirectory, "js")));
app.use("/assets", express.static(path.join(publicDirectory, "assets")));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/student", studentRoutes);

app.get("/api/health", async (req, res) => {
    try {
        const [result] = await db.query("SELECT DATABASE() AS databaseName");

        res.status(200).json({
            success: true,
            message: "QUICKRR backend is running.",
            database: "Connected",
            databaseName: result[0].databaseName,
        });
    } catch (error) {
        console.error("Database connection error:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed.",
        });
    }
});

app.use((error, req, res, next) => {
    console.error("Request failed:", error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({ error: "The request could not be completed." });
});

module.exports = app;
