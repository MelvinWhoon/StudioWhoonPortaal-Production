-- SUPABASE DATABASE SCHEMA
-- This script creates all necessary tables and columns.
-- Run this in your Supabase SQL Editor.

-- 1. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'Planning',
    address TEXT,
    homes_count INTEGER DEFAULT 0,
    postal_code TEXT,
    city TEXT,
    manager TEXT,
    available_option_ids JSONB DEFAULT '[]'::jsonb,
    additional_photos JSONB DEFAULT '[]'::jsonb,
    internal_remarks TEXT,
    delivery_date TEXT,
    logo_url TEXT
);

-- Ensure logo_url exists if table was created earlier
ALTER TABLE projects ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. MASTER PACKAGES TABLE
CREATE TABLE IF NOT EXISTS master_packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    price NUMERIC,
    category TEXT DEFAULT 'Standaard',
    inclusions JSONB DEFAULT '[]'::jsonb,
    photos JSONB DEFAULT '[]'::jsonb,
    option_ids JSONB DEFAULT '[]'::jsonb
);

-- 3. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    case_number TEXT,
    plot_number TEXT,
    role TEXT NOT NULL,
    password TEXT,
    is_active BOOLEAN DEFAULT true,
    is_password_set BOOLEAN DEFAULT false,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    apartment_id TEXT,
    master_package_id TEXT REFERENCES master_packages(id) ON DELETE SET NULL,
    apartment_details JSONB DEFAULT '{}'::jsonb,
    construction_progress JSONB DEFAULT '{}'::jsonb,
    remarks TEXT,
    exceptions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to users if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS case_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plot_number TEXT;

-- 4. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    sender_id TEXT,
    sender_name TEXT,
    role TEXT,
    text TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    category TEXT,
    is_escalated BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false
);

-- 5. PORTAL DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS portal_documents (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    uploaded_by TEXT,
    role TEXT,
    date TEXT,
    size TEXT,
    external_url TEXT
);

-- 6. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    is_read BOOLEAN DEFAULT false
);

-- 7. AUTOMATIC NOTIFICATION TRIGGERS (For Speed)

-- Trigger for Messages
CREATE OR REPLACE FUNCTION notify_on_message()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role != 'CUSTOMER' THEN
        INSERT INTO notifications (id, user_id, text, date, is_read)
        VALUES (
            'n' || encode(gen_random_bytes(6), 'hex'),
            NEW.customer_id,
            'Nieuw bericht van ' || NEW.sender_name || ': "' || LEFT(NEW.text, 30) || '..."',
            NOW(),
            false
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_notify_on_message ON messages;
CREATE TRIGGER tr_notify_on_message
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION notify_on_message();

-- Trigger for Documents
CREATE OR REPLACE FUNCTION notify_on_document()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role != 'CUSTOMER' THEN
        INSERT INTO notifications (id, user_id, text, date, is_read)
        VALUES (
            'n' || encode(gen_random_bytes(6), 'hex'),
            NEW.customer_id,
            'Nieuw document geüpload: ' || NEW.file_name,
            NOW(),
            false
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_notify_on_document ON portal_documents;
CREATE TRIGGER tr_notify_on_document
AFTER INSERT ON portal_documents
FOR EACH ROW EXECUTE FUNCTION notify_on_document();

-- 8. INITIAL SUPER ADMIN
INSERT INTO users (id, email, name, role, password, is_active, is_password_set)
VALUES (
    'admin-1', 
    'marketing@whoon.com', 
    'Super Admin', 
    'SUPER_ADMIN', 
    'admin123', 
    true, 
    true
) ON CONFLICT (email) DO NOTHING;

-- 9. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
