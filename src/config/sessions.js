require("dotenv").config();

const session = require("express-session");

const MySQLStore = require("express-mysql-session")(session);

const options = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    createDatabaseTable: true,
    clearExpired: true,
    checkExpirationInterval: 900000,
    expiration: 86400000
};

const sessionStore = new MySQLStore(options);

const sessionMiddleware = session({
    name: "quickrr.sid",

    secret: process.env.SESSION_SECRET,

    store: sessionStore,

    resave: false,
    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 86400000
    }
});

module.exports = sessionMiddleware;