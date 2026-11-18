let users = [];
let editingId = null;


// API REQUEST HELPER

async function api(url, options = {}) {

    const response = await fetch(url, {
        ...options,

        credentials: "same-origin",

        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json();

    if (response.status === 401) {
        location.href = "/login.html";
        throw new Error("Please log in.");
    }

    if (response.status === 403) {
        throw new Error("Admin access required.");
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }

    return data;

}


// VERIFY ADMIN

async function verifyAdmin() {

    const data = await api("/api/auth/me");

    if (data.user.role !== "admin") {
        location.href = "/login.html";
        return false;
    }

    return true;

}


// LOAD USERS

async function loadUsers() {

    try {

        const data = await api("/api/admin/users");

        users = data.users;

        renderUsers();

        updateStatistics();

    } catch (error) {

        alert(error.message);

    }

}


// RENDER USERS

function renderUsers() {

    const search = document
        .getElementById("search")
        .value.toLowerCase();

    const role = document
        .getElementById("roleFilter")
        .value;

    const status = document
        .getElementById("statusFilter")
        .value;

    const filtered = users.filter(user => {

        return (

            (user.name.toLowerCase().includes(search) ||
            user.email.toLowerCase().includes(search)) &&

            (!role || user.role === role) &&

            (!status || user.status === status)

        );

    });

    document.getElementById("userTable").innerHTML =
        filtered.map(user => `

        <tr>

            <td>${user.id}</td>

            <td>${escapeHTML(user.name)}</td>

            <td>${escapeHTML(user.email)}</td>

            <td>${user.role}</td>

            <td>${user.status}</td>

            <td>

                <div class="actions">

                    <button onclick="editUser(${user.id})">
                        Edit
                    </button>

                    <button
                        class="secondary"
                        onclick="toggleStatus(${user.id}, '${user.status}')"
                    >
                        ${user.status === "active" ? "Deactivate" : "Activate"}
                    </button>

                    <button
                        class="danger"
                        onclick="resetPassword(${user.id})"
                    >
                        Reset Password
                    </button>

                </div>

            </td>

        </tr>

    `).join("");

}


// BASIC HTML ESCAPING

function escapeHTML(value) {

    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);

}


// UPDATE STATISTICS

function updateStatistics() {

    document.getElementById("totalUsers").textContent =
        users.length;

    document.getElementById("students").textContent =
        users.filter(u => u.role === "student").length;

    document.getElementById("staff").textContent =
        users.filter(u => u.role === "staff").length;

    document.getElementById("activeUsers").textContent =
        users.filter(u => u.status === "active").length;

}


// OPEN MODAL

function openModal() {

    editingId = null;

    document.getElementById("userForm").reset();

    document.getElementById("modalTitle").textContent =
        "Create User";

    document.getElementById("password").required = true;

    document.getElementById("userModal").style.display =
        "flex";

}


// CLOSE MODAL

function closeModal() {

    document.getElementById("userModal").style.display =
        "none";

}


// EDIT USER

function editUser(id) {

    const user = users.find(u => u.id === id);

    if (!user) return;

    editingId = id;

    document.getElementById("name").value = user.name;
    document.getElementById("email").value = user.email;
    document.getElementById("role").value = user.role;

    document.getElementById("password").value = "";
    document.getElementById("password").required = false;

    document.getElementById("modalTitle").textContent =
        "Edit User";

    openExistingModal();

}

function openExistingModal() {

    document.getElementById("userModal").style.display =
        "flex";

}


// SAVE USER

document.getElementById("userForm").addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        try {

            const payload = {

                name: document.getElementById("name").value,
                email: document.getElementById("email").value,
                role: document.getElementById("role").value

            };

            let url;
            let method;

            if (editingId) {

                url = `/api/admin/users/${editingId}`;
                method = "PUT";

            } else {

                payload.password =
                    document.getElementById("password").value;

                url = "/api/admin/users";
                method = "POST";

            }

            const result = await api(url, {

                method,

                body: JSON.stringify(payload)

            });

            alert(result.message);

            closeModal();

            await loadUsers();

        } catch (error) {

            alert(error.message);

        }

    }

);


// ACTIVATE / DEACTIVATE

async function toggleStatus(id, currentStatus) {

    const newStatus =
        currentStatus === "active" ? "inactive" : "active";

    if (!confirm(`Change account status to ${newStatus}?`)) {
        return;
    }

    try {

        await api(`/api/admin/users/${id}/status`, {

            method: "PATCH",

            body: JSON.stringify({
                status: newStatus
            })

        });

        await loadUsers();

    } catch (error) {

        alert(error.message);

    }

}


// RESET PASSWORD

async function resetPassword(id) {

    const newPassword = prompt(
        "Enter a new temporary password (minimum 12 characters):"
    );

    if (!newPassword) return;

    if (newPassword.length < 12) {
        alert("Password must contain at least 12 characters.");
        return;
    }

    try {

        const result = await api(
            `/api/admin/users/${id}/password`,

            {
                method: "PATCH",

                body: JSON.stringify({
                    newPassword
                })
            }
        );

        alert(result.message);

    } catch (error) {

        alert(error.message);

    }

}


// SEARCH AND FILTER

document.getElementById("search").addEventListener(
    "input",
    renderUsers
);

document.getElementById("roleFilter").addEventListener(
    "change",
    renderUsers
);

document.getElementById("statusFilter").addEventListener(
    "change",
    renderUsers
);


// LOGOUT

async function logout() {

    try {

        await api("/api/auth/logout", {
            method: "POST"
        });

        location.href = "/login.html";

    } catch (error) {

        alert(error.message);

    }

}


// INITIALIZATION

(async function init() {

    try {

        const isAdmin = await verifyAdmin();

        if (isAdmin) {
            await loadUsers();
        }

    } catch (error) {

        location.href = "/login.html";

    }

})();