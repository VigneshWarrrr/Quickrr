const sections = document.querySelector("#settings-sections");
const userName = document.querySelector("#settings-user-name");
const homeLink = document.querySelector("#settings-home-link");
const logoutButton = document.querySelector("#settings-logout");
const themeForm = document.querySelector("#theme-form");
const themeMessage = document.querySelector("#theme-message");
const themeCurrent = document.querySelector("#theme-current");
const passwordForm = document.querySelector("#password-form");
const passwordMessage = document.querySelector("#password-message");
const saveThemeButton = document.querySelector("#save-theme");
const savePasswordButton = document.querySelector("#save-password");

let csrfToken = "";
let userRole = "";

const dashboardForRole = {
    student: { href: "/index.html", title: "Menu & orders" },
    admin: { href: "/admin.html", title: "Accounts" },
    staff: { href: "/staff.html", title: "Orders" },
};

function makeSectionLink(href, title, active = false) {
    const link = document.createElement("a");
    link.className = `staff-section-link${active ? " active" : ""}`;
    link.href = href;
    link.textContent = title;
    if (active) {
        link.setAttribute("aria-current", "page");
    }
    return link;
}

function renderSections(role) {
    const heading = document.createElement("p");
    heading.className = "staff-sections-title";
    heading.textContent = "Sections";
    sections.dataset.role = role;
    sections.replaceChildren(heading);

    const dashboard = dashboardForRole[role];
    if (dashboard) {
        sections.appendChild(makeSectionLink(dashboard.href, dashboard.title));
    }
    if (role === "admin") {
        sections.appendChild(makeSectionLink("/staff.html", "Orders"));
        sections.appendChild(makeSectionLink("/staff-menu.html", "Menu management"));
    } else if (role === "staff") {
        sections.appendChild(makeSectionLink("/staff-menu.html", "Menu management"));
    }
    sections.appendChild(makeSectionLink("/settings.html", "Settings", true));
}

function applyTheme(theme) {
    const selectedTheme = theme === "dark" ? "dark" : "light";
    document.body.dataset.theme = selectedTheme;
    themeCurrent.textContent = selectedTheme === "dark" ? "Dark theme" : "Light theme";
    const selectedInput = themeForm.querySelector(`input[name="theme"][value="${selectedTheme}"]`);
    if (selectedInput) {
        selectedInput.checked = true;
    }
}

async function readJson(response) {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 401) {
            window.location.replace("/login.html");
        }
        throw new Error(result.error || `Request failed (${response.status}).`);
    }
    return result;
}

async function initializeSettings() {
    try {
        const [sessionResponse, preferencesResponse] = await Promise.all([
            fetch("/api/auth/session", { credentials: "same-origin" }),
            fetch("/api/auth/preferences", { credentials: "same-origin" }),
        ]);
        const [session, preferences] = await Promise.all([
            readJson(sessionResponse),
            readJson(preferencesResponse),
        ]);

        userRole = session.user.role;
        csrfToken = session.csrfToken;
        userName.textContent = session.user.name;
        homeLink.href = dashboardForRole[userRole]?.href || "/";
        renderSections(userRole);
        applyTheme(preferences.theme);
    } catch (error) {
        themeMessage.textContent = error.message || "Could not load your settings.";
    }
}

themeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const theme = new FormData(themeForm).get("theme");
    saveThemeButton.disabled = true;
    themeMessage.textContent = "";
    try {
        const response = await fetch("/api/auth/preferences/theme", {
            method: "PATCH",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({ theme }),
        });
        const result = await readJson(response);
        applyTheme(result.theme);
        themeMessage.textContent = "Theme preference saved for your account.";
    } catch (error) {
        themeMessage.textContent = error.message || "Could not save your theme.";
    } finally {
        saveThemeButton.disabled = false;
    }
});

passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const currentPassword = document.querySelector("#current-password").value;
    const newPassword = document.querySelector("#new-password").value;
    const confirmPassword = document.querySelector("#confirm-password").value;
    passwordMessage.textContent = "";

    if (newPassword !== confirmPassword) {
        passwordMessage.textContent = "The new password and confirmation do not match.";
        return;
    }
    if (newPassword.length < 12) {
        passwordMessage.textContent = "The new password must be at least 12 characters.";
        return;
    }

    savePasswordButton.disabled = true;
    try {
        const response = await fetch("/api/auth/password", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({ currentPassword, newPassword }),
        });
        await readJson(response);
        passwordForm.reset();
        passwordMessage.textContent = "Your password was changed successfully.";
    } catch (error) {
        passwordMessage.textContent = error.message || "Could not change your password.";
    } finally {
        savePasswordButton.disabled = false;
    }
});

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    try {
        const response = await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
            headers: { "X-CSRF-Token": csrfToken },
        });
        if (!response.ok) {
            await readJson(response);
        }
        window.location.replace("/login.html");
    } catch (error) {
        passwordMessage.textContent = error.message || "Could not sign out.";
        logoutButton.disabled = false;
    }
});

initializeSettings();
