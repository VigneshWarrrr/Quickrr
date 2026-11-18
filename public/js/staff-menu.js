const staffName = document.querySelector("#staff-name");
const sections = document.querySelector("#staff-sections");
const logoutButton = document.querySelector("#staff-logout");
const menuList = document.querySelector("#staff-menu-list");
const menuCount = document.querySelector("#menu-item-count");
const emptyMenu = document.querySelector("#empty-menu");
const menuMessage = document.querySelector("#menu-message");
const createForm = document.querySelector("#create-menu-form");
const createButton = document.querySelector("#create-menu-button");
const refreshButton = document.querySelector("#refresh-menu");

let csrfToken = "";

function renderSections(role) {
    const links = [];
    if (role === "admin") {
        links.push(["/admin.html", "Accounts"]);
    }
    links.push(
        ["/staff.html", "Orders"],
        ["/staff-menu.html", "Menu management"],
        ["/settings.html", "Settings"]
    );
    const heading = document.createElement("p");
    heading.className = "staff-sections-title";
    heading.textContent = "Sections";
    sections.dataset.role = role;
    sections.replaceChildren(heading, ...links.map(([href, label]) => {
        const link = document.createElement("a");
        link.className = `staff-section-link${href === "/staff-menu.html" ? " active" : ""}`;
        link.href = href;
        link.textContent = label;
        if (href === "/staff-menu.html") {
            link.setAttribute("aria-current", "page");
        }
        return link;
    }));
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

function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}

function createMenuItemCard(item) {
    const card = makeElement("article", `staff-menu-item${item.isAvailable ? "" : " staff-menu-item-unavailable"}`);
    const header = makeElement("div", "staff-menu-item-header");
    const title = makeElement("h3", "", item.name);
    const availability = makeElement(
        "span",
        `menu-availability ${item.isAvailable ? "menu-availability-on" : "menu-availability-off"}`,
        item.isAvailable ? "Available" : "Unavailable"
    );
    const form = makeElement("form", "staff-menu-edit-form");
    const fields = [
        ["Name", "name", item.name, 100],
        ["Price (₹)", "price", item.price, 16],
        ["Category", "category", item.category || "", 50],
        ["Description", "description", item.description || "", 1000],
    ];

    header.append(title, availability);
    form.dataset.itemId = String(item.id);

    for (const [labelText, name, value, maxLength] of fields) {
        const label = makeElement("label", "");
        const labelTextElement = makeElement("span", "", labelText);
        const input = makeElement("input", "");
        input.name = name;
        input.value = value;
        input.maxLength = maxLength;
        if (name === "name") {
            input.required = true;
        } else if (name === "price") {
            input.type = "number";
            input.min = "0.01";
            input.max = "99999999.99";
            input.step = "0.01";
            input.required = true;
        }
        label.append(labelTextElement, input);
        form.appendChild(label);
    }

    const actions = makeElement("div", "staff-menu-item-actions");
    const saveButton = makeElement("button", "filter-button", "Save changes");
    saveButton.type = "submit";
    const availabilityButton = makeElement("button", "cancel-button", item.isAvailable ? "Make unavailable" : "Make available");
    availabilityButton.type = "button";
    availabilityButton.addEventListener("click", () => updateAvailability(item, !item.isAvailable, availabilityButton));
    actions.append(saveButton, availabilityButton);
    form.appendChild(actions);
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        saveMenuItem(item.id, form, saveButton);
    });

    card.append(header, form);
    return card;
}

async function loadMenu() {
    refreshButton.disabled = true;
    menuMessage.textContent = "";
    menuCount.textContent = "Loading…";
    try {
        const response = await fetch("/api/staff/menu", { credentials: "same-origin" });
        const result = await readJson(response);
        menuList.replaceChildren(...result.items.map(createMenuItemCard));
        menuCount.textContent = `${result.items.length} ${result.items.length === 1 ? "item" : "items"}`;
        emptyMenu.hidden = result.items.length > 0;
    } catch (error) {
        menuList.replaceChildren();
        emptyMenu.hidden = true;
        menuCount.textContent = "Could not load";
        menuMessage.textContent = error.message || "Could not load the menu.";
    } finally {
        refreshButton.disabled = false;
    }
}

async function saveMenuItem(itemId, form, button) {
    const formData = new FormData(form);
    const item = {
        name: String(formData.get("name")).trim(),
        price: Number(formData.get("price")),
        category: String(formData.get("category")).trim() || null,
        description: String(formData.get("description")).trim() || null,
    };
    button.disabled = true;
    menuMessage.textContent = "";

    try {
        const response = await fetch(`/api/staff/menu/${encodeURIComponent(itemId)}`, {
            method: "PATCH",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify(item),
        });
        await readJson(response);
        menuMessage.textContent = "Menu item updated.";
        await loadMenu();
    } catch (error) {
        menuMessage.textContent = error.message || "Could not update this menu item.";
        button.disabled = false;
    }
}

async function updateAvailability(item, isAvailable, button) {
    button.disabled = true;
    menuMessage.textContent = "";
    try {
        if (isAvailable) {
            const response = await fetch(`/api/staff/menu/${encodeURIComponent(item.id)}`, {
                method: "PATCH",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken,
                },
                body: JSON.stringify({ isAvailable: true }),
            });
            await readJson(response);
        } else {
            const response = await fetch(`/api/staff/menu/${encodeURIComponent(item.id)}`, {
                method: "DELETE",
                credentials: "same-origin",
                headers: { "X-CSRF-Token": csrfToken },
            });
            await readJson(response);
        }
        menuMessage.textContent = isAvailable ? "Item is available to students." : "Item is now unavailable to students.";
        await loadMenu();
    } catch (error) {
        menuMessage.textContent = error.message || "Could not change item availability.";
        button.disabled = false;
    }
}

async function initializeStaffPage() {
    try {
        const response = await fetch("/api/auth/session", { credentials: "same-origin" });
        const result = await readJson(response);
        if (!["staff", "admin"].includes(result.user.role)) {
            const rolePages = { student: "/index.html" };
            window.location.replace(rolePages[result.user.role] || "/login.html");
            return;
        }
        staffName.textContent = result.user.name;
        csrfToken = result.csrfToken;
        renderSections(result.user.role);
        await loadMenu();
    } catch (error) {
        menuMessage.textContent = error.message || "Could not verify the staff session.";
    }
}

createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(createForm);
    const item = {
        name: String(formData.get("name")).trim(),
        price: Number(formData.get("price")),
        category: String(formData.get("category")).trim() || null,
        description: String(formData.get("description")).trim() || null,
    };
    createButton.disabled = true;
    menuMessage.textContent = "";
    try {
        const response = await fetch("/api/staff/menu", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify(item),
        });
        const result = await readJson(response);
        createForm.reset();
        menuMessage.textContent = `${result.item.name} added to the menu.`;
        await loadMenu();
    } catch (error) {
        menuMessage.textContent = error.message || "Could not add this menu item.";
    } finally {
        createButton.disabled = false;
    }
});

refreshButton.addEventListener("click", loadMenu);

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
        menuMessage.textContent = error.message || "Could not sign out.";
        logoutButton.disabled = false;
    }
});

initializeStaffPage();
