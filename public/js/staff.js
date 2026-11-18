const staffName = document.querySelector("#staff-name");
const sections = document.querySelector("#staff-sections");
const staffMessage = document.querySelector("#staff-message");
const logoutButton = document.querySelector("#staff-logout");
const refreshButton = document.querySelector("#refresh-orders");
const filtersForm = document.querySelector("#order-filters");
const searchInput = document.querySelector("#order-search");
const statusFilter = document.querySelector("#order-status");
const orderList = document.querySelector("#order-list");
const emptyOrders = document.querySelector("#empty-orders");
const emptyOrdersMessage = document.querySelector("#empty-orders-message");
const paginationSummary = document.querySelector("#pagination-summary");
const pageIndicator = document.querySelector("#page-indicator");
const previousPageButton = document.querySelector("#previous-page");
const nextPageButton = document.querySelector("#next-page");
const summaryCounts = {
    all: document.querySelector("#count-all"),
    Pending: document.querySelector("#count-pending"),
    Accepted: document.querySelector("#count-accepted"),
    Preparing: document.querySelector("#count-preparing"),
    Ready: document.querySelector("#count-ready"),
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
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let refreshTimer;

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
        link.className = `staff-section-link${href === "/staff.html" ? " active" : ""}`;
        link.href = href;
        link.textContent = label;
        if (href === "/staff.html") {
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

function formatAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount)
        ? new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(amount)
        : "—";
}

function makeElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
        element.className = className;
    }
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}

function createOrderCard(order) {
    const card = makeElement("article", "order-card");
    const header = makeElement("div", "order-card-header");
    const titleBlock = makeElement("div", "order-title-block");
    const orderNumber = makeElement("h2", "order-number", `Order #${order.orderNumber}`);
    const createdAt = makeElement("p", "order-created-at", formatDate(order.createdAt));
    const status = makeElement("span", `order-status-badge order-status-${order.status.toLowerCase()}`, statusLabels[order.status] || order.status);
    const details = makeElement("div", "order-card-details");
    const customer = makeElement("div", "order-customer");
    const customerName = makeElement("strong", "", order.customerName);
    const customerEmail = makeElement("span", "", order.customerEmail);
    const itemsHeading = makeElement("h3", "order-items-heading", "Items");
    const items = makeElement("ul", "order-items");
    const footer = makeElement("div", "order-card-footer");
    const total = makeElement("strong", "order-total", `Total ${formatAmount(order.totalAmount)}`);

    titleBlock.append(orderNumber, createdAt);
    header.append(titleBlock, status);
    customer.append(customerName, customerEmail);

    for (const item of order.items) {
        const line = makeElement(
            "li",
            "order-item",
            `${item.quantity} × ${item.name} · ${formatAmount(item.subtotal)}`
        );
        items.appendChild(line);
    }

    details.append(customer, makeElement("div", "order-item-details"));
    details.lastElementChild.append(itemsHeading, items);
    footer.appendChild(total);

    if (order.queuePosition !== null) {
        const queueBadge = makeElement(
            "span",
            `queue-position${order.queuePosition === 1 ? " queue-position-next" : ""}`,
            order.queuePosition === 1 ? "Next in queue" : `Queue #${order.queuePosition}`
        );
        footer.insertBefore(queueBadge, footer.firstChild);
        const actionByStatus = {
            Pending: { status: "Preparing", label: "Start preparing" },
            Accepted: { status: "Preparing", label: "Start preparing" },
            Preparing: { status: "Ready", label: "Mark ready for pickup" },
            Ready: { status: "Collected", label: "Mark collected" },
        };
        const action = actionByStatus[order.status];
        if (action) {
            const actionButton = makeElement("button", "ready-button", action.label);
            actionButton.type = "button";
            actionButton.disabled = order.queuePosition !== 1;
            if (order.queuePosition !== 1) {
                actionButton.title = "Complete the earlier orders in the queue first.";
            }
            actionButton.addEventListener("click", () => updateOrderStatus(order.id, action.status, actionButton));
            footer.appendChild(actionButton);
        }
    }

    card.append(header, details, footer);
    return card;
}

function updateSummary(counts) {
    summaryCounts.all.textContent = String(
        Object.values(counts).reduce((total, count) => total + count, 0)
    );
    for (const status of ["Pending", "Accepted", "Preparing", "Ready"]) {
        summaryCounts[status].textContent = String(counts[status] || 0);
    }
}

function setLoadingState(loading) {
    isLoading = loading;
    refreshButton.disabled = loading;
    previousPageButton.disabled = loading || currentPage <= 1;
    nextPageButton.disabled = loading || currentPage >= totalPages;
    filtersForm.querySelector("button[type='submit']").disabled = loading;
}

async function loadOrders() {
    if (isLoading) {
        return;
    }

    const query = new URLSearchParams({
        page: String(currentPage),
        pageSize: "20",
        status: statusFilter.value,
        search: searchInput.value.trim(),
    });

    staffMessage.textContent = "";
    paginationSummary.textContent = "Loading orders…";
    setLoadingState(true);

    try {
        const response = await fetch(`/api/staff/orders?${query}`, { credentials: "same-origin" });
        const result = await readJson(response);

        orderList.replaceChildren(...result.orders.map(createOrderCard));
        updateSummary(result.counts);
        currentPage = result.page;
        totalPages = Math.max(1, result.totalPages);
        pageIndicator.textContent = `${result.page} / ${totalPages}`;
        paginationSummary.textContent = result.total === 0
            ? "No orders to show"
            : `Showing ${(result.page - 1) * result.pageSize + 1}–${Math.min(result.page * result.pageSize, result.total)} of ${result.total}`;
        emptyOrders.hidden = result.orders.length > 0;
        emptyOrdersMessage.textContent = searchInput.value.trim() || statusFilter.value
            ? "Try changing the search or status filter."
            : "Orders will appear here when students place them.";
    } catch (error) {
        orderList.replaceChildren();
        emptyOrders.hidden = true;
        paginationSummary.textContent = "Could not load orders";
        staffMessage.textContent = error.message || "Could not load orders.";
    } finally {
        setLoadingState(false);
    }
}

async function updateOrderStatus(orderId, status, button) {
    button.disabled = true;
    staffMessage.textContent = "";

    try {
        const response = await fetch(`/api/staff/orders/${encodeURIComponent(orderId)}/status`, {
            method: "PATCH",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({ status }),
        });
        await readJson(response);
        await loadOrders();
        if (!staffMessage.textContent) {
            staffMessage.textContent = `Order updated to ${statusLabels[status] || status}.`;
        }
    } catch (error) {
        staffMessage.textContent = error.message || "Could not update the order.";
        button.disabled = false;
    }
}

async function loadStaffSession() {
    try {
        const response = await fetch("/api/auth/session", { credentials: "same-origin" });
        const result = await readJson(response);

        if (!["staff", "admin"].includes(result.user.role)) {
            window.location.replace("/index.html");
            return;
        }

        csrfToken = result.csrfToken;
        staffName.textContent = result.user.name;
        renderSections(result.user.role);
        await loadOrders();
        refreshTimer = window.setInterval(loadOrders, 30000);
    } catch (error) {
        staffMessage.textContent = error.message || "Could not connect to the staff service.";
    }
}

filtersForm.addEventListener("submit", (event) => {
    event.preventDefault();
    currentPage = 1;
    loadOrders();
});

refreshButton.addEventListener("click", loadOrders);

previousPageButton.addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage -= 1;
        loadOrders();
    }
});

nextPageButton.addEventListener("click", () => {
    if (currentPage < totalPages) {
        currentPage += 1;
        loadOrders();
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
            const result = await response.json();
            throw new Error(result.error || "Could not sign out.");
        }

        window.clearInterval(refreshTimer);
        window.location.replace("/login.html");
    } catch (error) {
        staffMessage.textContent = error.message || "Could not sign out.";
        logoutButton.disabled = false;
    }
});

loadStaffSession();
