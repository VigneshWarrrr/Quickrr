const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const loginRole = document.querySelector("#login-role");
const loginIdentifier = document.querySelector("#login-identifier");
const loginIdentifierLabel = document.querySelector("#login-identifier-label");
const loginNote = document.querySelector("#login-note");
const loginPassword = document.querySelector("#login-password");
let csrfToken = "";

const requestedRole = new URLSearchParams(window.location.search).get("role");
if (["student", "admin", "staff"].includes(requestedRole)) {
    loginRole.value = requestedRole;
}

function updateIdentifierPrompt() {
    const isStaff = loginRole.value === "staff";
    const isStudent = loginRole.value === "student";
    loginIdentifierLabel.textContent = isStudent
        ? "Email address or username"
        : isStaff ? "Staff ID or email address" : "Email address";
    loginIdentifier.placeholder = isStudent
        ? "you@college.edu or username"
        : isStaff ? "Staff ID or you@gmail.com" : "you@college.edu";
    loginIdentifier.maxLength = 254;
    loginIdentifier.inputMode = "text";
    loginIdentifier.title = isStudent
        ? "Enter your student email address or username."
        : isStaff
            ? "Enter your staff ID or the email address on your account."
            : "Enter your administrator email address.";
    loginNote.textContent = isStudent
        ? "Students can sign in with their email address or username and password."
        : isStaff
            ? "Staff can sign in with their staff ID or account email and password."
            : "Administrators: sign in with your email address and password.";
}

loginRole.addEventListener("change", updateIdentifierPrompt);
updateIdentifierPrompt();

async function loadCsrfToken() {
    try {
        const response = await fetch("/api/auth/csrf", { credentials: "same-origin" });
        const result = await response.json();

        if (!response.ok || typeof result.csrfToken !== "string") {
            throw new Error(result.error || "Sign-in service is unavailable.");
        }

        csrfToken = result.csrfToken;
    } catch (error) {
        loginMessage.textContent = error.message || "Could not connect to the sign-in service.";
    }
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginMessage.textContent = "";

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({
                role: loginRole.value,
                identifier: loginIdentifier.value,
                password: loginPassword.value,
            }),
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Sign-in failed.");
        }

        loginPassword.value = "";

        if (result.role === "admin") {
            window.location.assign("/admin.html");
        } else if (result.role === "staff") {
            window.location.assign("/staff.html");
        } else {
            window.location.assign("/index.html");
        }
    } catch (error) {
        loginMessage.textContent = error.message || "Could not connect to the sign-in service.";
    }
});

loadCsrfToken();
