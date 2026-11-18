# Administrator account management

The administrator dashboard is available at `/admin.html`; sign in from the shared `/login.html` page by selecting the Admin role. It lists all student, admin, and staff accounts from the configured MySQL database. Administrators can create student, admin, and staff accounts; filter/search the directory; and edit account profile details and active/inactive status. Account creation requires a contact email and an initial password of at least 12 characters. Staff accounts also require a unique Staff ID for sign-in. Password hashes are never shown or editable after creation. Accounts with order history cannot be permanently deleted; deactivate them instead. The currently signed-in admin and the last active admin are also protected from deletion.

## Initial setup

1. Configure valid `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` values in `.env`. The MySQL account must be able to create/read/write the session table and read/update the `users` table. Apply `database/schema.sql` to the configured database. Reapplying it also updates an existing `users.role` enum to include `staff`. For existing databases, back up the database and run `npm.cmd run migrate-users`; it adds missing profile and preference columns and removes the obsolete `student_id` column without deleting account rows. Any values stored in `student_id` are discarded.
2. Set `SESSION_SECRET` in `.env` to a persistent random value of at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Do not commit `.env` or share the generated value. Production startup requires this setting.
3. Create the first administrator from PowerShell. The password prompt below is hidden, and the temporary environment variables are removed when the command completes:

   ```powershell
   $env:ADMIN_EMAIL = Read-Host "Administrator Gmail"
   $securePassword = Read-Host "Initial administrator password" -AsSecureString
   $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
   try {
       $env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
       npm run create-admin
   }
   finally {
       Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
       [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
       $securePassword.Dispose()
   }
   ```

   Choose a password with at least 12 characters. The command stores only a bcrypt hash.
4. To create both requested starter accounts, set the two email addresses and run the one-time `seed-users` command. It generates a separate strong temporary password for each account, stores only bcrypt hashes, and prints each password once after both account inserts succeed:

   ```powershell
   $env:ADMIN_EMAIL = "your-admin@gmail.com"
   $env:STUDENT_EMAIL = "student@college.edu"
   npm run seed-users
   Remove-Item Env:ADMIN_EMAIL, Env:STUDENT_EMAIL -ErrorAction SilentlyContinue
   ```

   The command creates an administrator named `Quickrr Admin` and a student named `Vigi`. It refuses to modify accounts if either email already exists. Save the one-time passwords securely. Alternatively, `npm run create-admin` creates a single administrator with an explicitly configured password.
5. Start the server with `npm start`. The root URL (`http://localhost:3000/`) redirects to the shared sign-in page. Choose Student, Admin, or Staff from the role selector; the old `/admin-login.html` URL redirects to the same page with Admin preselected.

The shared sign-in authenticates active student, admin, and staff records against their bcrypt password hashes and requires the selected role to match the account. Students can sign in with their email or the exact username stored in the `name` column; the student account form labels this field **Student username**. Staff accounts must have `role = 'staff'` in the `users` table. In development, if `SESSION_SECRET` is missing or too short, the server uses a temporary random secret and warns that sessions will end on restart.

## Creating a staff account and signing in

All three roles use the same `/login.html` page. Students can sign in with their account email or the username stored in their account's `name` column. Staff can sign in with either their staff ID or account email; staff IDs are case-insensitive at login. Administrators continue to sign in with their email address. A contact email is still required when creating an account.

After applying `database/schema.sql` or running `npm.cmd run migrate-users` for an existing database, create a staff account from PowerShell. The password prompt is hidden; the helper stores only a bcrypt hash:

```powershell
$env:STAFF_ID = Read-Host "Staff ID (for example STAFF-001)"
$env:STAFF_NAME = Read-Host "Staff name"
$env:STAFF_EMAIL = Read-Host "Staff contact email"
$securePassword = Read-Host "Staff password" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $env:STAFF_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    npm.cmd run create-staff
}
finally {
    Remove-Item Env:STAFF_ID, Env:STAFF_NAME, Env:STAFF_EMAIL, Env:STAFF_PASSWORD -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $securePassword.Dispose()
}
```

Choose a unique staff ID of up to 64 letters, digits, hyphens, or underscores, and a password of at least 12 characters. Start or restart the app with `npm.cmd start`, open `http://localhost:3000/`, choose **Staff**, and enter either the staff ID or contact email with the password. Successful login opens the staff order dashboard. The Admin account directory can also display and edit staff IDs.

Administrator API requests use a MySQL-backed session that remains valid for up to 24 hours, CSRF-token checks for changes, parameterized SQL, and a per-IP sign-in attempt limit. Sessions are not capped at 10 users: the MySQL session store keeps each user's session independently, so multiple students, staff, and administrators can stay signed in at once. The application and session database pools each allow 20 concurrent database connections and queue excess requests without an application-side queue limit. The configured database must also allow enough connections; for example, the current MySQL server reports a limit of 151. The dashboard can update profiles and deactivate accounts across all roles; it cannot change roles or edit passwords.

The front page, admin dashboard, and operations workspace require a valid session for an active account with the corresponding role. Administrators may open both staff operations pages; staff remain limited to their operations pages, and students are redirected to the student dashboard. Static assets remain public, but dashboard HTML is served only after the server verifies the session against the active user record.

## Staff order dashboard

Sign in from `/login.html` with the Staff role to open `/staff.html`. The dashboard lists orders with customer and item details, provides status/search filters, and refreshes automatically every 30 seconds. Status changes require an active staff session and CSRF token. `database/schema.sql` creates the menu, order, and order-item tables for new installations; the `CREATE TABLE IF NOT EXISTS` statements leave existing order data and table definitions untouched. When no orders have been placed, the dashboard shows an empty state.

The **Sections** navigation on the admin dashboard includes Accounts, Orders, Menu management, and Settings. Administrators can use the Orders and Menu management pages and all their APIs, in addition to account management. Staff can switch between Orders, Menu management, and Settings. Both roles can manage the FIFO order queue and create/edit menu items, prices, descriptions, categories, and availability. Students cannot access these staff/admin operations. Making a menu item unavailable preserves its order history while removing it from the student menu; it can be made available again later.

## Account settings

Students, administrators, and staff have a **Settings** link in their dashboard Sections column. It opens `/settings.html` in the same authenticated session. Each user can change their own password by entering the current password and a different new password of at least 12 characters. Passwords are stored as bcrypt hashes. The light/dark theme preference is stored on the user's account and applies across dashboards and devices after saving. Run `npm.cmd run migrate-users` on existing databases to add the `theme` preference column.

## Student cart and order lifecycle

The student dashboard loads available items from `menu_items`. To add the six example campus dishes without replacing existing menu records, run `npm.cmd run seed-menu`; this inserts only examples whose names are not already present. The student cart uses server-side prices at checkout, creates a unique order number, and records the order and item prices in one database transaction. Students can track their recent order statuses on the same page.

Staff process active orders strictly first-come, first-served by creation time and order ID: `Pending` (or legacy `Accepted`) → `Preparing` → `Ready` (shown as “Ready to pick up”) → `Collected`. The server locks and verifies the oldest active order for every status change, so filtering or multiple staff sessions cannot skip the queue. Cancelled and collected orders leave the active queue.

## Fixing MySQL authentication

If the login page reports that authentication is unavailable, MySQL is not accepting the database connection configured for the server. Do not use the MySQL `root` account in the app. In a MySQL client, create a dedicated app user (replace the database name, username, host, and password with your own values):

```sql
CREATE DATABASE IF NOT EXISTS quickrr
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE USER 'quickrr_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_A_STRONG_UNIQUE_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE
    ON quickrr.*
    TO 'quickrr_app'@'localhost';
```

Apply `database/schema.sql` to `quickrr` using a database administrator account, then set the matching `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` values in the local `.env` file. If MySQL is running on another machine/container, change the MySQL account host and `DB_HOST` to match that setup. Restart the server and verify `http://localhost:3000/api/health` reports a database connection. Set a persistent `SESSION_SECRET` of at least 32 characters as well. Never paste `.env` values into chat or commit them.
