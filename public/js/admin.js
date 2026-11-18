const adminIdentity = document.querySelector("#admin-identity");
const logoutButton = document.querySelector("#admin-logout");
const filtersForm = document.querySelector("#user-filters");
const searchInput = document.querySelector("#user-search");
const statusFilter = document.querySelector("#user-status");
const roleFilter = document.querySelector("#user-role");
const userRows = document.querySelector("#user-rows");
const emptyUsers = document.querySelector("#empty-users");
const emptyUsersMessage = document.querySelector("#empty-users-message");
const adminFeedback = document.querySelector("#admin-feedback");
const paginationSummary = document.querySelector("#pagination-summary");
const pageIndicator = document.querySelector("#page-indicator");
const studentCount = document.querySelector("#student-count");
const previousPageButton = document.querySelector("#previous-page");
const nextPageButton = document.querySelector("#next-page");
const createAccountButton = document.querySelector("#create-account");
const editDialog = document.querySelector("#edit-dialog");
const editForm = document.querySelector("#edit-user-form");
const editMessage = document.querySelector("#edit-message");
const createDialog = document.querySelector("#create-dialog");
const createForm = document.querySelector("#create-user-form");
const createMessage = document.querySelector("#create-message");
const createRole = document.querySelector("#create-role");
const editFields = {
    name: document.querySelector("#edit-name"),
    email: document.querySelector("#edit-email"),
    staffId: document.querySelector("#edit-staff-id"),
    phone: document.querySelector("#edit-phone"),
    status: document.querySelector("#edit-status"),
};

let csrfToken = "";
let currentPage = 1;
let totalPages = 1;
let selectedUser = null;

async function readJson(response) {
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        if (response.status === 401) {
            window.location.replace("/login.html?role=admin");
        }

        throw new Error(result.error || `Request failed (${response.status}).`);
    }

    return result;
}

function makeCell(value) {
    const cell = document.createElement("td");
    cell.textContent = value || "—";
    return cell;
}

function formatJoinDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "—"
        : new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function createUserRow(user) {
    const row = document.createElement("tr");
    const studentCell = document.createElement("td");
    const studentDetails = document.createElement("div");
    const name = document.createElement("strong");
    const email = document.createElement("span");
    const roleCell = document.createElement("td");
    const roleBadge = document.createElement("span");
    const statusCell = document.createElement("td");
    const statusBadge = document.createElement("span");
    const actionCell = document.createElement("td");
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");
    const actions = document.createElement("div");

    studentDetails.className = "student-details";
    name.textContent = user.name;
    email.textContent = user.email;
    studentDetails.append(name, email);
    studentCell.appendChild(studentDetails);

    roleBadge.className = `role-badge role-${user.role}`;
    roleBadge.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    roleCell.appendChild(roleBadge);

    statusBadge.className = `status-badge status-${user.status}`;
    statusBadge.textContent = user.status === "active" ? "Active" : "Inactive";
    statusCell.appendChild(statusBadge);

    editButton.className = "edit-user-button";
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.setAttribute("aria-label", `Edit ${user.name}`);
    editButton.addEventListener("click", () => openEditDialog(user));

    deleteButton.className = "delete-user-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete ${user.name}`);
    deleteButton.addEventListener("click", () => deleteUser(user, deleteButton));
    actions.className = "user-row-actions";
    actions.append(editButton, deleteButton);
    actionCell.appendChild(actions);

    row.append(
        studentCell,
        roleCell,
        makeCell(user.role === "staff" ? user.staffId : null),
        makeCell(user.phone),
        statusCell,
        makeCell(formatJoinDate(user.createdAt)),
        actionCell
    );

    return row;
}

function updateCreateFields() {
    const isStaff = createRole.value === "staff";
    const nameInput = document.querySelector("#create-name");
    const isStudent = createRole.value === "student";
    document.querySelector("#create-name-label").textContent = isStudent ? "Student username" : "Full name";
    nameInput.placeholder = isStudent ? "Used by the student to sign in" : "";
    document.querySelector("#create-staff-id-label").hidden = !isStaff;
    document.querySelector("#create-staff-id").hidden = !isStaff;
    document.querySelector("#create-staff-id").required = isStaff;
}

function openCreateDialog() {
    createForm.reset();
    createRole.value = "student";
    createMessage.textContent = "";
    updateCreateFields();
    createDialog.showModal();
    document.querySelector("#create-name").focus();
}

function setLoadingState(isLoading) {
    previousPageButton.disabled = isLoading || currentPage <= 1;
    nextPageButton.disabled = isLoading || currentPage >= totalPages;
}

async function deleteUser(user, button) {
    if (!window.confirm(`Permanently delete ${user.name}'s account? Accounts with order history cannot be deleted; deactivate those instead.`)) {
        return;
    }

    button.disabled = true;
    adminFeedback.textContent = "";

    try {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
            method: "DELETE",
            credentials: "same-origin",
            headers: { "X-CSRF-Token": csrfToken },
        });
        await readJson(response);
        adminFeedback.textContent = `Deleted ${user.name}'s account.`;
        await loadUsers();
    } catch (error) {
        adminFeedback.textContent = error.message || "Could not delete this account.";
        button.disabled = false;
    }
}

async function loadUsers() {
    const query = new URLSearchParams({
        page: String(currentPage),
        pageSize: "10",
        search: searchInput.value.trim(),
        status: statusFilter.value,
        role: roleFilter.value,
    });

    adminFeedback.textContent = "";
    paginationSummary.textContent = "Loading accounts…";
    setLoadingState(true);

    try {
        const response = await fetch(`/api/admin/users?${query}`, { credentials: "same-origin" });
        const result = await readJson(response);

        userRows.replaceChildren(...result.users.map(createUserRow));
        studentCount.textContent = String(result.total);
        totalPages = Math.max(1, result.totalPages);
        pageIndicator.textContent = `${result.page} / ${totalPages}`;
        paginationSummary.textContent = result.total === 0
            ? "No accounts to show"
            : `Showing ${(result.page - 1) * result.pageSize + 1}–${Math.min(result.page * result.pageSize, result.total)} of ${result.total}`;
        emptyUsers.hidden = result.users.length > 0;
        emptyUsersMessage.textContent = searchInput.value.trim() || statusFilter.value || roleFilter.value
            ? "Try changing the search or status filter."
            : "User accounts will appear here when they are added to the database.";
        currentPage = result.page;
    } catch (error) {
        userRows.replaceChildren();
        studentCount.textContent = "—";
        paginationSummary.textContent = "Could not load accounts";
        emptyUsers.hidden = true;
        adminFeedback.textContent = error.message || "Could not load user accounts.";
    } finally {
        setLoadingState(false);
    }
}

function openEditDialog(user) {
    selectedUser = user;
    editMessage.textContent = "";

    Object.entries(editFields).forEach(([field, input]) => {
        input.value = user[field] || "";
    });
    document.querySelector("#edit-name-label").textContent = user.role === "student" ? "Student username" : "Full name";
    editFields.name.placeholder = user.role === "student" ? "Used by the student to sign in" : "";
    document.querySelector("#edit-staff-id-label").hidden = user.role !== "staff";
    editFields.staffId.hidden = user.role !== "staff";
    editFields.staffId.required = user.role === "staff";

    editDialog.showModal();
    editFields.name.focus();
}

async function initializeAdminPage() {
    try {
        const response = await fetch("/api/admin/session", { credentials: "same-origin" });
        const result = await readJson(response);

        csrfToken = result.csrfToken;
        adminIdentity.textContent = result.admin.email;
        await loadUsers();
    } catch (error) {
        adminFeedback.textContent = error.message || "Could not verify the administrator session.";
    }
}

filtersForm.addEventListener("submit", (event) => {
    event.preventDefault();
    currentPage = 1;
    loadUsers();
});

statusFilter.addEventListener("change", () => {
    currentPage = 1;
    loadUsers();
});

roleFilter.addEventListener("change", () => {
    currentPage = 1;
    loadUsers();
});

previousPageButton.addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage -= 1;
        loadUsers();
    }
});

nextPageButton.addEventListener("click", () => {
    if (currentPage < totalPages) {
        currentPage += 1;
        loadUsers();
    }
});

document.querySelector("#close-edit").addEventListener("click", () => editDialog.close());
document.querySelector("#cancel-edit").addEventListener("click", () => editDialog.close());
createAccountButton.addEventListener("click", openCreateDialog);
createRole.addEventListener("change", updateCreateFields);
document.querySelector("#close-create").addEventListener("click", () => createDialog.close());
document.querySelector("#cancel-create").addEventListener("click", () => createDialog.close());

createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    createMessage.textContent = "";

    const account = {
        role: createRole.value,
        name: document.querySelector("#create-name").value.trim(),
        email: document.querySelector("#create-email").value.trim(),
        phone: document.querySelector("#create-phone").value.trim() || null,
        password: document.querySelector("#create-password").value,
    };

    if (account.role === "staff") {
        account.staffId = document.querySelector("#create-staff-id").value.trim();
    }

    const createButton = document.querySelector("#save-create");
    createButton.disabled = true;

    try {
        const response = await fetch("/api/admin/users", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify(account),
        });
        const result = await readJson(response);
        createDialog.close();
        createForm.reset();
        searchInput.value = "";
        statusFilter.value = "";
        roleFilter.value = "";
        currentPage = 1;
        adminFeedback.textContent = `Created ${result.user.role} account for ${result.user.name}.`;
        await loadUsers();
    } catch (error) {
        createMessage.textContent = error.message || "Could not create the account.";
    } finally {
        createButton.disabled = false;
    }
});

editForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!selectedUser) {
        editMessage.textContent = "Select an account before saving.";
        return;
    }

    const updates = {
        name: editFields.name.value.trim(),
        email: editFields.email.value.trim(),
        phone: editFields.phone.value.trim() || null,
        status: editFields.status.value,
    };

    if (selectedUser.role === "staff") {
        updates.staffId = editFields.staffId.value.trim();
    }
    const saveButton = editForm.querySelector(".save-button");
    saveButton.disabled = true;
    editMessage.textContent = "";

    try {
        const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
            method: "PATCH",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify(updates),
        });
        const result = await readJson(response);
        editDialog.close();
        selectedUser = null;
        adminFeedback.textContent = `Updated ${result.user.name}'s account.`;
        await loadUsers();
    } catch (error) {
        editMessage.textContent = error.message || "Could not update this account.";
    } finally {
        saveButton.disabled = false;
    }
});

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    try {
        const response = await fetch("/api/admin/logout", {
            method: "POST",
            credentials: "same-origin",
            headers: { "X-CSRF-Token": csrfToken },
        });

        if (!response.ok) {
            await readJson(response);
        }

        window.location.replace("/login.html?role=admin");
    } catch (error) {
        adminFeedback.textContent = error.message || "Could not sign out.";
        logoutButton.disabled = false;
    }
});

initializeAdminPage();
