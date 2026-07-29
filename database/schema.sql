-- NaijaCart schema (MySQL 8.x, works on RDS MySQL / Aurora MySQL)
-- Run against your RDS endpoint after the instance is up:
--   mysql -h <rds-endpoint> -u admin -p < schema.sql
CREATE DATABASE IF NOT EXISTS naijacart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE naijacart;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(190)  NOT NULL UNIQUE,
  password_hash VARCHAR(100)  NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(160)   NOT NULL,
  description  TEXT,
  price_ngn    DECIMAL(12,2)  NOT NULL,
  stock        INT            NOT NULL DEFAULT 0,
  image_url    VARCHAR(500),
  active       TINYINT(1)     NOT NULL DEFAULT 1,
  created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT            NOT NULL,
  total_ngn   DECIMAL(12,2)  NOT NULL,
  status      ENUM('PLACED','PAID','SHIPPED','DELIVERED','CANCELLED') NOT NULL DEFAULT 'PLACED',
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  order_id        INT           NOT NULL,
  product_id      INT           NOT NULL,
  qty             INT           NOT NULL,
  unit_price_ngn  DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_items_order   FOREIGN KEY (order_id)   REFERENCES orders(id),
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

CREATE INDEX idx_orders_user   ON orders(user_id);
CREATE INDEX idx_items_order   ON order_items(order_id);
