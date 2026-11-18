const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcrypt");

const db = require("../config/db");

const router = express.Router();
const loginAttempts = new Map();
const maxLoginAttempts = 5;
const loginWindowMs = 15 * 60 * 1000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedRoles = new Set(["student", "admin", "staff"]);
const dummyPasswordHash = "$2b$12$3R5Zo1mteNYjR/prEyVH6OdqpYSjBByq0JbUtNM008Q7gVZN9Arja";

router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

function getCsrfToken(req) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }

    return req.session.csrfToken;
}

function hasValidCsrfToken(req) {
    const expectedToken = req.session?.csrfToken;
    const suppliedToken = req.get("X-CSRF-Token");

    if (!expectedToken || !suppliedToken || !/^[a-f0-9]{64}$/.test(suppliedToken)) {
        return false;
    }

    return crypto.timingSafeEqual(Buffer.from(expectedToken), Buffer.from(suppliedToken));
}

function getLoginAttempt(ipAddress) {
    const now = Date.now();
    const attempt = loginAttempts.get(ipAddress);

    if (!attempt || now >= attempt.resetAt) {
        const freshAttempt = { count: 0, resetAt: now + loginWindowMs };
        loginAttempts.set(ipAddress, freshAttempt);
        return freshAttempt;
    }

    return attempt;
}

function redirectForRole(role) {
    return {
        student: "/index.html",
        admin: "/admin.html",
        staff: "/staff.html",
    }[role];
}

router.get("/csrf", (req, res) => {
    res.json({ csrfToken: getCsrfToken(req) });
});

router.post("/login", async (req, res) => {
    if (!hasValidCsrfToken(req)) {
        return res.status(403).json({ error: "Your session expired. Refresh the page and try again." });
    }

    const attempt = getLoginAttempt(req.ip);

    if (attempt.count >= maxLoginAttempts) {
        return res.status(429).json({ error: "Too many sign-in attempts. Please wait 15 minutes and try again." });
    }

    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const role = typeof body.role === "string" ? body.role : "";
    const rawIdentifier = typeof body.identifier === "string"
        ? body.identifier
        : typeof body.email === "string" ? body.email : "";
    const identifier = rawIdentifier.trim();
    const password = typeof body.password === "string" ? body.password : "";
    const isStaff = role === "staff";
    const isEmail = emailPattern.test(identifier) && identifier.length <= 254;
    const normalizedIdentifier = isStaff && !isEmail
        ? identifier.toUpperCase()
        : isEmail ? identifier.toLowerCase() : identifier;
    const validIdentifier = identifier.length > 0 && (role === "admin"
        ? isEmail
        : role === "student"
            ? identifier.length <= (isEmail ? 254 : 100)
            : isEmail || /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(identifier));

    if (!allowedRoles.has(role) || !validIdentifier || !password || password.length > 200) {
        attempt.count += 1;
        return res.status(401).json({ error: "Invalid role, sign-in ID or password." });
    }

    let accountQuery;
    let accountParameters;
    if (role === "student") {
        accountQuery = "SELECT id, name, email, password_hash FROM users WHERE role = 'student' AND status = 'active' AND (email = ? OR name = ?)";
        accountParameters = [isEmail ? normalizedIdentifier : identifier, identifier];
    } else if (isStaff && !isEmail) {
        accountQuery = "SELECT id, name, email, password_hash FROM users WHERE staff_id = ? AND role = 'staff' AND status = 'active' LIMIT 1";
        accountParameters = [normalizedIdentifier];
    } else {
        accountQuery = "SELECT id, name, email, password_hash FROM users WHERE email = ? AND role = ? AND status = 'active' LIMIT 1";
        accountParameters = [normalizedIdentifier, role];
    }

    const [users] = await db.execute(accountQuery, accountParameters);
    const matchedUsers = await Promise.all(users.map(async (candidate) => ({
        candidate,
        matches: await bcrypt.compare(password, candidate.password_hash),
    })));
    const user = matchedUsers.find(({ matches }) => matches)?.candidate;
    if (matchedUsers.length === 0) {
        await bcrypt.compare(password, dummyPasswordHash);
    }

    if (!user) {
        attempt.count += 1;
        return res.status(401).json({ error: "Invalid role, sign-in ID or password." });
    }

    loginAttempts.delete(req.ip);

    req.session.regenerate((error) => {
        if (error) {
            return res.status(500).json({ error: "Could not start your session." });
        }

        req.session[`${role}Id`] = user.id;
        req.session.userRole = role;
        req.session.userName = user.name;
        req.session.userEmail = user.email;
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");

        req.session.save((saveError) => {
            if (saveError) {
                return res.status(500).json({ error: "Could not save your session." });
            }

            res.json({
                role,
                user: { name: user.name, email: user.email },
                redirect: redirectForRole(role),
            });
        });
    });
});

router.get("/session", async (req, res) => {
    const role = req.session?.userRole;
    const userId = req.session?.[`${role}Id`];

    if (!allowedRoles.has(role) || !userId) {
        return res.status(401).json({ error: "Sign in is required." });
    }

    const [users] = await db.execute(
        "SELECT name, email FROM users WHERE id = ? AND role = ? AND status = 'active' LIMIT 1",
        [userId, role]
    );

    if (users.length === 0) {
        return req.session.destroy((error) => {
            if (error) {
                return res.status(500).json({ error: "Could not end the expired session." });
            }

            res.clearCookie("quickrr.sid");
            res.status(401).json({ error: "Sign in is required." });
        });
    }

    res.json({
        csrfToken: getCsrfToken(req),
        user: { role, name: users[0].name, email: users[0].email },
    });
});

async function getActiveSessionUser(req, res) {
    const role = req.session?.userRole;
    const userId = req.session?.[`${role}Id`];

    if (!allowedRoles.has(role) || !userId) {
        res.status(401).json({ error: "Sign in is required." });
        return null;
    }

    const [users] = await db.execute(
        "SELECT id, role FROM users WHERE id = ? AND role = ? AND status = 'active' LIMIT 1",
        [userId, role]
    );

    if (users.length === 0) {
        req.session.destroy((error) => {
            if (error) {
                res.status(500).json({ error: "Could not end the expired session." });
                return;
            }
            res.clearCookie("quickrr.sid");
            res.status(401).json({ error: "Sign in is required." });
        });
        return null;
    }

    return users[0];
}

router.get("/preferences", async (req, res) => {
    const user = await getActiveSessionUser(req, res);
    if (!user) {
        return;
    }

    const [rows] = await db.execute(
        "SELECT theme FROM users WHERE id = ? AND role = ? LIMIT 1",
        [user.id, user.role]
    );
    res.json({ theme: rows[0].theme });
});

router.patch("/preferences/theme", async (req, res) => {
    if (!hasValidCsrfToken(req)) {
        return res.status(403).json({ error: "Your session expired. Refresh the page and try again." });
    }

    const user = await getActiveSessionUser(req, res);
    if (!user) {
        return;
    }

    const theme = req.body?.theme;
    if (!["light", "dark"].includes(theme)) {
        return res.status(400).json({ error: "Choose the light or dark theme." });
    }

    await db.execute(
        "UPDATE users SET theme = ? WHERE id = ? AND role = ? AND status = 'active'",
        [theme, user.id, user.role]
    );
    res.json({ theme });
});

router.post("/password", async (req, res) => {
    if (!hasValidCsrfToken(req)) {
        return res.status(403).json({ error: "Your session expired. Refresh the page and try again." });
    }

    const user = await getActiveSessionUser(req, res);
    if (!user) {
        return;
    }

    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    if (!currentPassword || currentPassword.length > 200
        || newPassword.length < 12 || newPassword.length > 200) {
        return res.status(400).json({ error: "Enter your current password and a new password of 12–200 characters." });
    }

    const [rows] = await db.execute(
        "SELECT password_hash FROM users WHERE id = ? AND role = ? AND status = 'active' LIMIT 1",
        [user.id, user.role]
    );
    const matches = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!matches) {
        return res.status(401).json({ error: "Your current password is incorrect." });
    }

    if (await bcrypt.compare(newPassword, rows[0].password_hash)) {
        return res.status(400).json({ error: "Choose a new password different from your current password." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.execute(
        "UPDATE users SET password_hash = ? WHERE id = ? AND role = ? AND status = 'active'",
        [passwordHash, user.id, user.role]
    );
    res.json({ success: true });
});

router.post("/logout", (req, res) => {
    if (!hasValidCsrfToken(req)) {
        return res.status(403).json({ error: "Your session expired. Refresh the page and try again." });
    }

    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({ error: "Could not end your session." });
        }

        res.clearCookie("quickrr.sid");
        res.status(204).end();
    });
});

module.exports = router;
