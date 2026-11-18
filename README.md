# QUICKRR

QUICKRR is a role-based campus canteen and food-ordering web application. It provides a student storefront, a staff dashboard for menu and order management, and an administrator dashboard for account management.

The application uses Express.js for the server, MySQL for persistent data and sessions, bcrypt for password hashing, and server-rendered HTML/CSS/JavaScript in the `public/` directory.

## Features

### Students
- Browse available menu items by category
- Build a cart and place an order
- View order history, item details, totals, and status
- Track queue positions
- Change the light or dark theme
- Update the account password

### Staff
- Manage menu items and availability
- View and search customer orders
- Update order status through:
  `Pending` -> `Accepted` -> `Preparing` -> `Ready` -> `Collected`
- Cancel orders when required
- View order queue and status counts

### Administrators
- Create, search, update, activate, or deactivate accounts
- Manage student, staff, and administrator roles
- Maintain staff IDs and contact details
- Delete accounts that have no associated order history
- Access staff menu and order-management tools

## Technology Stack

- **Runtime:** Node.js
- **Server:** Express.js
- **Database:** MySQL or MariaDB
- **Database driver:** `mysql2/promise`
- **Authentication:** `express-session`, MySQL-backed sessions, bcrypt
- **Frontend:** HTML, CSS, vanilla JavaScript
- **Development runner:** Nodemon

## Project Structure

```text
quickrr/
|-- database/
|   |-- schema.sql       # Database tables and constraints
|   `-- seed.sql         # Optional SQL seed file
|-- docs/
|   `-- admin.md         # Additional administrator documentation
|-- public/
|   |-- index.html       # Student menu and orders
|   |-- login.html       # Shared role-based login
|   |-- staff.html       # Staff order dashboard
|   |-- staff-menu.html  # Staff menu management
|   |-- admin.html       # Administrator dashboard
|   |-- settings.html    # Profile and theme settings
|   |-- css/
|   |-- js/
|   `-- assets/
|-- src/
|   |-- app.js           # Express app configuration
|   |-- server.js        # HTTP server entry point
|   |-- config/          # Database and session configuration
|   |-- controllers/
|   |-- middleware/
|   |-- routes/          # Authentication and role APIs
|   `-- utils/           # Account and menu setup utilities
|-- package.json
`-- README.md
```

## Prerequisites

Install the following before running QUICKRR:

- [Node.js](https://nodejs.org/) 18 or newer
- npm, included with Node.js
- MySQL 8 or MariaDB
- Git

MySQL must allow a user account to create and use the QUICKRR database and session table.

## 1. Clone the Project

Replace the repository URL with the URL for this project:

```bash
git clone <repository-url>
cd <repository-folder>
```

For example, if the repository is hosted on GitHub:

```bash
git clone https://github.com/<username>/<repository-name>.git
cd <repository-name>
```

If the project is already on your computer, open a terminal in the project root (the directory containing `package.json`) and continue with the installation steps.

## 2. Install Dependencies

From the project root:

```bash
npm install
```

## 3. Create the MySQL Database

Open MySQL:

```bash
mysql -u root -p
```

Create the database:

```sql
CREATE DATABASE quickrr
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

EXIT;
```

Then import the schema:

```bash
mysql -u root -p quickrr < database/schema.sql
```

On Windows PowerShell, if `<` input redirection is unavailable or does not behave as expected, import the file from the MySQL client:

```sql
USE quickrr;
SOURCE C:/full/path/to/database/schema.sql;
```

Use forward slashes or escaped Windows paths for `SOURCE`, for example:

```sql
SOURCE C:\\VIGNESHWARAN\\PROGRAMS\\HTML\\proj\\database\\schema.sql;
```

The session library also creates and maintains its own sessions table automatically when the server starts.

## 4. Configure Environment Variables

Create a local environment file:

```bash
cp .env.example .env
```

On Windows Command Prompt, use:

```bat
copy .env.example .env
```

Configure `.env`:

```dotenv
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=quickrr_user
DB_PASSWORD=your_database_password
DB_NAME=quickrr

SESSION_SECRET=replace_with_a_long_random_secret

# Used when creating or resetting an administrator
ADMIN_NAME=Quickrr Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace_with_a_strong_password
ADMIN_NEW_PASSWORD=replace_with_a_strong_password

# Used when creating a staff account
STAFF_NAME=Sample Staff
STAFF_ID=STAFF001
STAFF_EMAIL=staff@example.com
STAFF_PASSWORD=replace_with_a_strong_password

# Used by the sample account seeding utility
STUDENT_EMAIL=student@example.com
```

Variable details:

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port; defaults to `3000` |
| `DB_HOST` | Yes | MySQL host |
| `DB_PORT` | No | MySQL port; defaults to `3306` |
| `DB_USER` | Yes | MySQL application user |
| `DB_PASSWORD` | Yes | MySQL application password |
| `DB_NAME` | Yes | Database name, normally `quickrr` |
| `SESSION_SECRET` | Yes | Long random value used to sign sessions |
| `ADMIN_*` | For admin setup/reset | Administrator account variables |
| `STAFF_*` | For staff setup | Staff account variables |
| `STUDENT_EMAIL` | For sample account seeding | Student email used by `npm run seed-users` |

Never commit `.env`. Generate a strong session secret, for example:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Use the generated value for `SESSION_SECRET`.

## 5. Create Account and Menu Data

You must create at least one account before the login pages become usable.

### Create an administrator

Set `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` in `.env`, then run:

```bash
npm run create-admin
```

The password must contain 12 to 200 characters. This command refuses to overwrite an existing email address.

### Create a staff account

Set `STAFF_ID`, `STAFF_NAME`, `STAFF_EMAIL`, and `STAFF_PASSWORD`, then run:

```bash
npm run create-staff
```

Staff accounts can sign in with either their staff ID or email address.

### Seed sample menu items

```bash
npm run seed-menu
```

This safely adds the bundled sample menu items and leaves existing items unchanged.

### Optional: seed one admin and one student

Set `ADMIN_EMAIL` and `STUDENT_EMAIL` in `.env`, then run:

```bash
npm run seed-users
```

This creates a random temporary password for both accounts and prints those passwords once in the terminal. Change or reset them as soon as possible.

### Optional legacy password migration

If an existing database contains plaintext passwords, migrate them to bcrypt hashes:

```bash
npm run migrate-users
```

Review and back up the database before running migration tools.

## 6. Run the Application

### Development mode

Development mode restarts the server when source files change:

```bash
npm run dev
```

### Production-style mode

```bash
npm start
```

The default application URL is:

```text
http://localhost:3000
```

If `PORT` is changed in `.env`, use that port instead.

## Application URLs

| Page | URL | Access |
|---|---|---|
| Login | `http://localhost:3000/login.html` | Public |
| Student menu and orders | `http://localhost:3000/index.html` | Student |
| Staff orders | `http://localhost:3000/staff.html` | Staff or administrator |
| Staff menu | `http://localhost:3000/staff-menu.html` | Staff or administrator |
| Administration | `http://localhost:3000/admin.html` | Administrator |
| Settings | `http://localhost:3000/settings.html` | Authenticated users |
| Health check | `http://localhost:3000/api/health` | Public |

The `/` and `/admin-login.html` routes redirect to the appropriate login page.

## Login Behaviour

- **Student:** sign in with a registered email or account name.
- **Staff:** sign in with the staff ID or registered email.
- **Administrator:** sign in with the registered email.

The login flow uses CSRF protection and rate-limits sign-in attempts. After five failed attempts from the same IP, login is blocked for 15 minutes.

## NPM Commands

| Command | Purpose |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start with Nodemon |
| `npm run create-admin` | Create an administrator |
| `npm run create-staff` | Create a staff account |
| `npm run seed-menu` | Add bundled sample menu items |
| `npm run seed-users` | Add one administrator and one student with temporary passwords |
| `npm run migrate-users` | Migrate legacy plaintext passwords to bcrypt |

The password reset and password migration utilities can also be run directly:

```bash
node src/reset-admin-password.js
node src/migrate-passwords.js
```

The reset utility uses `ADMIN_EMAIL` and `ADMIN_NEW_PASSWORD` from `.env`.

## Database Tables

- `users` - student, staff, and administrator accounts
- `menu_items` - menu products and availability
- `orders` - customer order totals and status
- `order_items` - products, quantities, prices, and subtotals for each order
- `sessions` - server-managed user sessions

Orders retain item snapshots using unit prices and subtotals. Menu availability is controlled rather than deleted from the staff interface.

## API Overview

All protected endpoints require an authenticated session and are role-checked by the server.

| Area | Endpoints |
|---|---|
| Authentication | `/api/auth/csrf`, `/api/auth/login`, `/api/auth/session`, `/api/auth/preferences`, `/api/auth/password`, `/api/auth/logout` |
| Student | `/api/student/menu`, `/api/student/orders` |
| Staff | `/api/staff/menu`, `/api/staff/orders`, `/api/staff/orders/:id/status` |
| Administrator | `/api/admin/users`, `/api/admin/session`, `/api/admin/logout` |
| Health | `/api/health` |

State-changing API requests must include the session CSRF token in the `X-CSRF-Token` header.

## Development Notes

- The server serves static frontend files from `public/`.
- Sessions are stored in MySQL and expire after one day.
- Secure cookies are enabled automatically when `NODE_ENV=production`.
- The server uses the `quickrr.sid` session cookie name.
- Page routes verify that the session user still exists and is active.
- All passwords are hashed with bcrypt cost 12.

For local HTTP development, leave `NODE_ENV` unset or set it to `development`.

## Troubleshooting

### Database connection fails

- Confirm MySQL is running.
- Verify `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`.
- Confirm the database user has access to the `quickrr` database.
- Run `/api/health` after the server starts.

### Login cannot find the account

- Confirm an account was created with the matching role.
- Confirm the account status is `active`.
- Staff should use the staff ID or email from account setup.
- Recreate or reset the account only if the existing credentials are invalid.

### Sessions or schema errors

- Verify the database import completed successfully.
- Restart the server so the session library can initialize its table.
- Check that the session table and application tables share the same database.

### Port already in use

Change `PORT` in `.env`, for example:

```dotenv
PORT=3001
```

Then restart the server.

### Native dependency installation fails

`bcrypt` should support current Node.js releases. If installation fails, verify Node.js and npm are both for the same architecture and recreate dependencies:

```bash
rm -rf node_modules
npm install
```

On Windows Command Prompt or PowerShell, remove `node_modules` through File Explorer or with a targeted directory removal command.

## Security Recommendations

- Use a unique strong `SESSION_SECRET`.
- Use a dedicated MySQL account rather than an unrestricted root account.
- Never commit `.env`, credentials, or generated passwords.
- Use HTTPS and set `NODE_ENV=production` when deploying.
- Change temporary passwords immediately after seeding.
- Restrict database and application access through firewall rules.

## License

No license has been defined in `package.json`. Add a license file and update the `license` field before distributing the project publicly.
