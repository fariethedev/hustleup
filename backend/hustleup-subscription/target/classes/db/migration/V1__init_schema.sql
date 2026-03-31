-- HustleUp Schema V1
-- Users
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    role VARCHAR(20) NOT NULL DEFAULT 'BUYER',
    avatar_url VARCHAR(500),
    bio TEXT,
    city VARCHAR(100),
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    is_id_verified BOOLEAN DEFAULT FALSE,
    id_document_url VARCHAR(500),
    vouch_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh Tokens
CREATE TABLE refresh_tokens (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expiry_date TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Listings
CREATE TABLE listings (
    id VARCHAR(50) PRIMARY KEY,
    seller_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    listing_type VARCHAR(30) NOT NULL,
    price DECIMAL(12,4) NOT NULL,
    currency VARCHAR(5) DEFAULT 'PLN',
    is_negotiable BOOLEAN DEFAULT FALSE,
    location_city VARCHAR(100),
    meta TEXT,
    media_urls TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    version BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id)
);

-- Bookings
CREATE TABLE bookings (
    id VARCHAR(50) PRIMARY KEY,
    buyer_id VARCHAR(50) NOT NULL,
    seller_id VARCHAR(50) NOT NULL,
    listing_id VARCHAR(50) NOT NULL,
    offered_price DECIMAL(12,4),
    counter_price DECIMAL(12,4),
    agreed_price DECIMAL(12,4),
    currency VARCHAR(5) DEFAULT 'PLN',
    scheduled_at TIMESTAMP,
    status VARCHAR(30) DEFAULT 'POSTED',
    cancel_reason TEXT,
    version BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (buyer_id) REFERENCES users(id),
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (listing_id) REFERENCES listings(id)
);

-- Chat Messages
CREATE TABLE chat_messages (
    id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL,
    sender_id VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'TEXT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- Reviews
CREATE TABLE reviews (
    id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL UNIQUE,
    reviewer_id VARCHAR(50) NOT NULL,
    reviewed_id VARCHAR(50) NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_id) REFERENCES users(id)
);

-- Notifications
CREATE TABLE notifications (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(30) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    reference_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Subscriptions
CREATE TABLE subscriptions (
    id VARCHAR(50) PRIMARY KEY,
    seller_id VARCHAR(50) NOT NULL UNIQUE,
    plan VARCHAR(30) DEFAULT 'FREE',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    price_per_month DECIMAL(12,4) DEFAULT 20.00,
    currency VARCHAR(5) DEFAULT 'PLN',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id)
);

-- Community Vouches
CREATE TABLE vouches (
    id VARCHAR(50) PRIMARY KEY,
    voucher_id VARCHAR(50) NOT NULL,
    vouched_for_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (voucher_id) REFERENCES users(id),
    FOREIGN KEY (vouched_for_id) REFERENCES users(id),
    UNIQUE(voucher_id, vouched_for_id)
);
