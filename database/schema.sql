CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    staff_id VARCHAR(64) NULL,
    phone VARCHAR(32) NULL,
    theme ENUM('light', 'dark') NOT NULL DEFAULT 'light',
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'admin', 'staff') NOT NULL DEFAULT 'student',
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY users_email_unique (email),
    UNIQUE KEY users_staff_id_unique (staff_id),
    KEY users_role_status_name (role, status, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
    MODIFY role ENUM('student', 'admin', 'staff') NOT NULL DEFAULT 'student';

CREATE TABLE IF NOT EXISTS menu_items (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(50) NULL,
    image_url VARCHAR(500) NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
    id INT NOT NULL AUTO_INCREMENT,
    order_number VARCHAR(30) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('Pending', 'Accepted', 'Preparing', 'Ready', 'Collected', 'Cancelled')
        NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY orders_order_number_unique (order_number),
    KEY orders_user_id_index (user_id),
    KEY orders_status_created_at_index (status, created_at),
    CONSTRAINT orders_user_id_foreign
        FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
    id INT NOT NULL AUTO_INCREMENT,
    order_id INT NOT NULL,
    menu_item_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (id),
    KEY order_items_order_id_index (order_id),
    KEY order_items_menu_item_id_index (menu_item_id),
    CONSTRAINT order_items_order_id_foreign
        FOREIGN KEY (order_id) REFERENCES orders (id),
    CONSTRAINT order_items_menu_item_id_foreign
        FOREIGN KEY (menu_item_id) REFERENCES menu_items (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
