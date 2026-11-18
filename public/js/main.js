const searchForm = document.querySelector("#menu-search");
const searchInput = document.querySelector("#food-search");
const menuGrid = document.querySelector("#menu-grid");
const categoryLinks = [...document.querySelectorAll(".category-chip")];
const emptyState = document.querySelector("#empty-state");
const cartCount = document.querySelector("#cart-count");
const cartItemCount = document.querySelector("#cart-item-count");
const cartLines = document.querySelector("#cart-lines");
const cartEmpty = document.querySelector("#cart-empty");
const cartTotal = document.querySelector("#cart-total");
const placeOrderButton = document.querySelector("#place-order");
const studentMessage = document.querySelector("#student-message");
const orderList = document.querySelector("#my-order-list");
const ordersEmpty = document.querySelector("#orders-empty");
const logoutButton = document.querySelector("#student-logout");
const refreshOrdersButton = document.querySelector("#refresh-my-orders");

const cart = new Map();
const placeholderClasses = ["placeholder-coral", "placeholder-yellow", "placeholder-green", "placeholder-blue", "placeholder-pink", "placeholder-lilac"];
const placeholderEmojis = {
    burger: "🍔",
    wrap: "🌯",
    fries: "🍟",
    coffee: "🧋",
    brownie: "🍫",
    rice: "🍚",
    meal: "🍛",
    snack: "🥪",
    drink: "🥤",
    dessert: "🧁",
};
const statusLabels = {
    Pending: "Order received",
    Accepted: "Accepted",
    Preparing: "Preparing",
    Ready: "Ready to pick up",
    Collected: "Collected",
    Cancelled: "Cancelled",
};

let csrfToken = "";
let selectedCategory = "";
let menuItems = [];
let ordersRefreshTimer;
let isPlacingOrder = false;

async function readJson(response) {
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        if (response.status === 401) {
            window.location.replace("/login.html?role=student");
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

function formatPrice(value) {
    const amount = Number(value);
    return Number.isFinite(amount)
        ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount)
        : "—";
}

function getEmoji(name, category) {
    const searchable = `${name} ${category || ""}`.toLowerCase();
    const match = Object.keys(placeholderEmojis).find((key) => searchable.includes(key));
    return match ? placeholderEmojis[match] : "🍽️";
}

function createMenuCard(item, index) {
    const card = makeElement("article", "menu-card");
    const photo = makeElement("div", `food-placeholder ${placeholderClasses[index % placeholderClasses.length]}`);
    const details = makeElement("div", "item-details");
    const titleRow = makeElement("div", "item-title-row");
    const title = makeElement("h3", "", item.name);
    const description = makeElement("p", "", item.description || "Freshly prepared on campus.");
    const metadata = makeElement("div", "item-meta");
    const category = makeElement("span", "", item.category || "Campus");
    const dot = makeElement("span", "meta-dot");
    const estimate = makeElement("span", "", "Made to order");
    const price = makeElement("strong", "", formatPrice(item.price));
    const addButton = makeElement("button", "add-to-cart-button", "Add to cart");

    if (item.imageUrl) {
        const image = makeElement("img", "menu-item-image");
        image.src = item.imageUrl;
        image.alt = item.name;
        image.loading = "lazy";
        photo.appendChild(image);
    } else {
        photo.append(
            makeElement("span", "placeholder-tag", "PHOTO PLACEHOLDER"),
            makeElement("span", "placeholder-emoji", getEmoji(item.name, item.category)),
            makeElement("span", "placeholder-label", "Add menu photo")
        );
    }

    titleRow.append(title);
    metadata.append(category, dot, estimate, price);
    addButton.type = "button";
    addButton.addEventListener("click", () => addToCart(item));
    details.append(titleRow, description, metadata, addButton);
    card.append(photo, details);
    card.dataset.search = `${item.name} ${item.category || ""}`.toLowerCase();
    card.dataset.category = (item.category || "").toLowerCase();
    return card;
}

function filterMenu() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    let visibleItems = 0;

    for (const card of menuGrid.children) {
        const matchesSearch = card.dataset.search.includes(searchTerm);
        const matchesCategory = !selectedCategory || card.dataset.category === selectedCategory.toLowerCase();
        card.hidden = !(matchesSearch && matchesCategory);
        visibleItems += Number(!card.hidden);
    }

    emptyState.hidden = visibleItems > 0;
    if (menuItems.length === 0) {
        emptyState.textContent = "The menu is not available yet. Please check back soon.";
        emptyState.hidden = false;
    } else {
        emptyState.textContent = "No menu items match that search. Try another dish or category.";
    }
}

function renderCart() {
    cartLines.replaceChildren();
    const items = [...cart.values()];
    const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
    const total = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

    cartCount.textContent = String(totalQuantity);
    cartItemCount.textContent = `${totalQuantity} ${totalQuantity === 1 ? "item" : "items"}`;
    cartTotal.textContent = formatPrice(total);
    cartEmpty.hidden = items.length > 0;
    placeOrderButton.disabled = items.length === 0 || isPlacingOrder;

    for (const item of items) {
        const line = makeElement("div", "cart-line");
        const details = makeElement("div", "cart-line-details");
        const name = makeElement("strong", "", item.name);
        const amount = makeElement("span", "", formatPrice(Number(item.price) * item.quantity));
        const controls = makeElement("div", "cart-quantity-controls");
        const decrease = makeElement("button", "quantity-button", "−");
        const quantity = makeElement("span", "cart-quantity", String(item.quantity));
        const increase = makeElement("button", "quantity-button", "+");
        const remove = makeElement("button", "remove-cart-item", "Remove");

        decrease.type = "button";
        decrease.setAttribute("aria-label", `Remove one ${item.name}`);
        decrease.disabled = item.quantity <= 1;
        decrease.addEventListener("click", () => changeQuantity(item.id, -1));
        increase.type = "button";
        increase.setAttribute("aria-label", `Add one ${item.name}`);
        increase.disabled = item.quantity >= 20;
        increase.addEventListener("click", () => changeQuantity(item.id, 1));
        remove.type = "button";
        remove.addEventListener("click", () => removeFromCart(item.id));

        controls.append(decrease, quantity, increase);
        details.append(name, amount);
        line.append(details, controls, remove);
        cartLines.appendChild(line);
    }
}

function addToCart(item) {
    const existing = cart.get(item.id);
    if (existing && existing.quantity >= 20) {
        studentMessage.textContent = "You can order up to 20 of each item.";
        return;
    }
    cart.set(item.id, { ...item, quantity: (existing?.quantity || 0) + 1 });
    studentMessage.textContent = "";
    renderCart();
}

function changeQuantity(itemId, difference) {
    const item = cart.get(itemId);
    if (!item) {
        return;
    }
    item.quantity = Math.min(20, Math.max(1, item.quantity + difference));
    renderCart();
}

function removeFromCart(itemId) {
    cart.delete(itemId);
    renderCart();
}

function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Date unavailable"
        : new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        }).format(date);
}

function createOrderCard(order) {
    const card = makeElement("article", "my-order-card");
    const header = makeElement("div", "my-order-header");
    const orderNumber = makeElement("strong", "", `Order #${order.orderNumber}`);
    const status = makeElement("span", `order-status-badge order-status-${order.status.toLowerCase()}`, statusLabels[order.status] || order.status);
    const date = makeElement("p", "my-order-date", formatDate(order.createdAt));
    const itemSummary = makeElement("p", "my-order-items", order.items.map((item) => `${item.quantity} × ${item.name}`).join(", "));
    const total = makeElement("strong", "my-order-total", formatPrice(order.totalAmount));

    header.append(orderNumber, status);
    card.append(header, date, itemSummary, total);
    return card;
}

async function loadOrders() {
    const response = await fetch("/api/student/orders", { credentials: "same-origin" });
    const result = await readJson(response);
    orderList.replaceChildren(...result.orders.map(createOrderCard));
    ordersEmpty.hidden = result.orders.length > 0;
}

async function loadMenu() {
    const response = await fetch("/api/student/menu", { credentials: "same-origin" });
    const result = await readJson(response);
    menuItems = result.items;
    menuGrid.replaceChildren(...menuItems.map(createMenuCard));
    filterMenu();
}

async function loadStudentSession() {
    try {
        const response = await fetch("/api/auth/session", { credentials: "same-origin" });
        const result = await readJson(response);
        if (result.user.role !== "student") {
            const rolePages = { admin: "/admin.html", staff: "/staff.html" };
            window.location.replace(rolePages[result.user.role] || "/login.html");
            return;
        }
        csrfToken = result.csrfToken;
        await Promise.all([loadMenu(), loadOrders()]);
        ordersRefreshTimer = window.setInterval(() => loadOrders().catch((error) => {
            studentMessage.textContent = error.message || "Could not refresh your orders.";
        }), 30000);
    } catch (error) {
        studentMessage.textContent = error.message || "Could not load the menu.";
    }
}

searchInput.addEventListener("input", filterMenu);

searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    filterMenu();
    document.querySelector("#menu").scrollIntoView({ behavior: "smooth" });
});

categoryLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
        event.preventDefault();
        selectedCategory = link.dataset.categoryFilter || "";
        searchInput.value = "";

        categoryLinks.forEach((categoryLink) => {
            const isSelected = categoryLink === link;
            categoryLink.classList.toggle("active", isSelected);
            categoryLink.setAttribute("aria-current", isSelected ? "true" : "false");
        });

        filterMenu();
    });
});

placeOrderButton.addEventListener("click", async () => {
    if (cart.size === 0 || isPlacingOrder) {
        return;
    }
    isPlacingOrder = true;
    studentMessage.textContent = "";
    renderCart();

    try {
        const response = await fetch("/api/student/orders", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({
                items: [...cart.values()].map(({ id, quantity }) => ({ id, quantity })),
            }),
        });
        const result = await readJson(response);
        cart.clear();
        studentMessage.textContent = `Order #${result.order.orderNumber} placed successfully.`;
        renderCart();
        await loadOrders();
        document.querySelector("#cart").scrollIntoView({ behavior: "smooth" });
    } catch (error) {
        studentMessage.textContent = error.message || "Could not place your order.";
    } finally {
        isPlacingOrder = false;
        renderCart();
    }
});

refreshOrdersButton.addEventListener("click", () => {
    loadOrders().catch((error) => {
        studentMessage.textContent = error.message || "Could not refresh your orders.";
    });
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
        window.clearInterval(ordersRefreshTimer);
        window.location.replace("/login.html");
    } catch (error) {
        studentMessage.textContent = error.message || "Could not sign out.";
        logoutButton.disabled = false;
    }
});

renderCart();
loadStudentSession();
