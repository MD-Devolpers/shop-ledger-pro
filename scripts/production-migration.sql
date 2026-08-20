-- ============================================================
-- Full production migration — safe to run multiple times
-- All statements use IF NOT EXISTS / IF NOT EXISTS guards
-- ============================================================

-- ── Core tables ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  username text NOT NULL UNIQUE,
  store_name text,
  password_hash text,
  google_id text UNIQUE,
  email text,
  language text NOT NULL DEFAULT 'en',
  role text NOT NULL DEFAULT 'user',
  email_verified boolean NOT NULL DEFAULT false,
  verification_token text,
  verification_token_expiry timestamptz,
  reset_token text,
  reset_token_expiry timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entries (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  type text NOT NULL CHECK (type IN ('cash_in','cash_out')),
  amount numeric(12,2) NOT NULL,
  description text,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','digital')),
  profit numeric(12,2),
  is_credit boolean NOT NULL DEFAULT false,
  is_fund_operation boolean NOT NULL DEFAULT false,
  customer_name text,
  contact_number text,
  source text CHECK (source IN ('product_sale','mobile_sale')),
  deleted_at timestamptz,
  entry_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credits (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  customer_name text NOT NULL,
  phone text,
  amount numeric(12,2) NOT NULL,
  description text,
  entry_id integer,
  type text NOT NULL CHECK (type IN ('given','received')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  due_date timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE credits ADD COLUMN IF NOT EXISTS entry_id integer;
CREATE INDEX IF NOT EXISTS credits_entry_id_idx ON credits (entry_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS closings (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  amount numeric(12,2) NOT NULL,
  source text NOT NULL DEFAULT 'cash' CHECK (source IN ('cash','digital')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Inventory master tables ────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_collections (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  company_id integer,
  category_id integer,
  collection_id integer,
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2) NOT NULL DEFAULT 0,
  stock_qty numeric(12,3) NOT NULL DEFAULT 0,
  min_stock_alert numeric(12,3) NOT NULL DEFAULT 0,
  expiry_date timestamptz,
  is_favorite boolean NOT NULL DEFAULT false,
  min_sale_price numeric(12,2),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Purchase bills ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_bills (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  supplier_name text NOT NULL,
  company_id integer,
  bill_number text NOT NULL,
  bill_date timestamptz NOT NULL DEFAULT now(),
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  attachment_url text,
  is_credit boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_bill_items (
  id serial PRIMARY KEY,
  bill_id integer NOT NULL,
  product_id integer NOT NULL,
  quantity numeric(12,3) NOT NULL,
  purchase_rate numeric(12,2) NOT NULL,
  sale_rate numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Product sales ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_sales (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  entry_id integer,
  credit_id integer,
  customer_name text,
  contact_number text,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','digital')),
  is_credit boolean NOT NULL DEFAULT false,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_profit numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  discount_type text NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('percent','fixed')),
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  cancelled_at timestamptz,
  cancelled_by integer,
  sale_date timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_sale_items (
  id serial PRIMARY KEY,
  sale_id integer NOT NULL,
  product_id integer NOT NULL,
  quantity numeric(12,3) NOT NULL,
  purchase_price numeric(12,2) NOT NULL,
  sale_price numeric(12,2) NOT NULL,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  discount_type text NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('percent','fixed')),
  line_total numeric(12,2) NOT NULL,
  profit numeric(12,2) NOT NULL DEFAULT 0,
  warranty_period text,
  warranty_custom_days integer,
  warranty_expiry_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Price history & returns ────────────────────────────────
CREATE TABLE IF NOT EXISTS product_price_history (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  product_id integer NOT NULL,
  purchase_price numeric(12,2),
  sale_price numeric(12,2),
  bill_id integer,
  source text NOT NULL DEFAULT 'purchase',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_returns (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  sale_id integer,
  product_id integer NOT NULL,
  quantity numeric(12,3) NOT NULL,
  return_amount numeric(12,2) NOT NULL DEFAULT 0,
  profit_reversed numeric(12,2) NOT NULL DEFAULT 0,
  reason text,
  is_resalable boolean NOT NULL DEFAULT false,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','digital')),
  return_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Company replacements ───────────────────────────────────
CREATE TABLE IF NOT EXISTS company_replacements (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  product_id integer NOT NULL,
  company_id integer,
  company_name text NOT NULL,
  sent_qty numeric(12,3) NOT NULL,
  received_qty numeric(12,3) NOT NULL DEFAULT 0,
  date_sent timestamptz NOT NULL,
  fault_reason text NOT NULL,
  customer_name text,
  reference_no text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partially_received','completed','rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS replacement_receives (
  id serial PRIMARY KEY,
  replacement_id integer NOT NULL,
  received_qty numeric(12,3) NOT NULL,
  receive_date timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Stock adjustments & payments ──────────────────────────
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  product_id integer NOT NULL,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('damaged','lost','expired','broken','personal_use','manual_add','manual_remove')),
  quantity numeric(12,3) NOT NULL,
  reason text,
  adjustment_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  company_id integer NOT NULL,
  amount numeric(12,2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','digital')),
  bill_id integer,
  payment_date timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_edit_history (
  id serial PRIMARY KEY,
  sale_id integer NOT NULL,
  user_id integer NOT NULL,
  edit_type text NOT NULL CHECK (edit_type IN ('edit','cancel')),
  old_values text,
  new_values text,
  edited_by_name text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Staff & settings ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_permissions (
  id serial PRIMARY KEY,
  user_id integer NOT NULL UNIQUE,
  can_see_purchase_price boolean NOT NULL DEFAULT false,
  can_see_profit boolean NOT NULL DEFAULT false,
  can_see_purchase_bills boolean NOT NULL DEFAULT false,
  can_edit_delete_sale boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_pin_settings (
  id serial PRIMARY KEY,
  user_id integer NOT NULL UNIQUE,
  pin_hash text,
  protected_pages text NOT NULL DEFAULT '[]',
  unlock_duration integer NOT NULL DEFAULT 10,
  pin_reset_token text,
  pin_reset_token_expiry timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bill_settings (
  id serial PRIMARY KEY,
  user_id integer NOT NULL UNIQUE,
  shop_name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  logo text,
  footer text NOT NULL DEFAULT '',
  quick_product_shortcut text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Mobile purchases ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS mobile_purchases (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  seller_name text NOT NULL,
  seller_phone text,
  seller_address text,
  seller_cnic text,
  imei text,
  imei2 text,
  mobile_model text NOT NULL,
  company text NOT NULL,
  color text,
  storage_capacity text,
  condition text NOT NULL DEFAULT 'used' CHECK (condition IN ('new','used','refurbished')),
  purchase_source text NOT NULL DEFAULT 'company' CHECK (purchase_source IN ('company','person')),
  entry_id integer,
  credit_id integer,
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock','sold')),
  purchase_date timestamptz NOT NULL DEFAULT now(),
  sold_at timestamptz,
  sold_to_name text,
  sold_to_phone text,
  sale_amount numeric(12,2),
  payment_method text CHECK (payment_method IN ('cash','digital')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Alter existing tables: add missing columns safely ─────
ALTER TABLE entries ADD COLUMN IF NOT EXISTS source text CHECK (source IN ('product_sale','mobile_sale'));
ALTER TABLE entries ADD COLUMN IF NOT EXISTS is_fund_operation boolean NOT NULL DEFAULT false;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS contact_number text;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS entry_date timestamptz;
UPDATE entries SET entry_date = created_at WHERE entry_date IS NULL;
ALTER TABLE entries ALTER COLUMN entry_date SET NOT NULL;
ALTER TABLE entries ALTER COLUMN entry_date SET DEFAULT now();
