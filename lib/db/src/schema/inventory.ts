import { pgTable, text, serial, timestamp, numeric, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Master Management Tables ─────────────────────────────────────────────────

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const productCollectionsTable = pgTable("product_collections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Products ─────────────────────────────────────────────────────────────────

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  companyId: integer("company_id"),
  categoryId: integer("category_id"),
  collectionId: integer("collection_id"),
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }).notNull().default("0"),
  salePrice: numeric("sale_price", { precision: 12, scale: 2 }).notNull().default("0"),
  stockQty: numeric("stock_qty", { precision: 12, scale: 3 }).notNull().default("0"),
  minStockAlert: numeric("min_stock_alert", { precision: 12, scale: 3 }).notNull().default("0"),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  isFavorite: boolean("is_favorite").notNull().default(false),
  minSalePrice: numeric("min_sale_price", { precision: 12, scale: 2 }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Purchase Bills ────────────────────────────────────────────────────────────

export const purchaseBillsTable = pgTable("purchase_bills", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  supplierName: text("supplier_name").notNull(),
  companyId: integer("company_id"),           // FK → companies.id (nullable)
  billNumber: text("bill_number").notNull(),
  billDate: timestamp("bill_date", { withTimezone: true }).notNull().defaultNow(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  attachmentUrl: text("attachment_url"),   // GCS path or URL for photo/PDF
  isCredit: boolean("is_credit").notNull().default(false),  // credit purchase (pay later)
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const purchaseBillItemsTable = pgTable("purchase_bill_items", {
  id: serial("id").primaryKey(),
  billId: integer("bill_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  purchaseRate: numeric("purchase_rate", { precision: 12, scale: 2 }).notNull(),
  saleRate: numeric("sale_rate", { precision: 12, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Product Sales ─────────────────────────────────────────────────────────────

export const productSalesTable = pgTable("product_sales", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  entryId: integer("entry_id"),           // FK → entries.id
  creditId: integer("credit_id"),         // FK → credits.id (if credit sale)
  customerName: text("customer_name"),
  contactNumber: text("contact_number"),
  paymentMethod: text("payment_method", { enum: ["cash", "digital"] }).notNull().default("cash"),
  isCredit: boolean("is_credit").notNull().default(false),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalProfit: numeric("total_profit", { precision: 12, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  discountType: text("discount_type", { enum: ["percent", "fixed"] }).notNull().default("fixed"),
  notes: text("notes"),
  status: text("status", { enum: ["active", "cancelled"] }).notNull().default("active"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledBy: integer("cancelled_by"),    // FK → users.id
  saleDate: timestamp("sale_date", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const productSaleItemsTable = pgTable("product_sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }).notNull(),
  salePrice: numeric("sale_price", { precision: 12, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  discountType: text("discount_type", { enum: ["percent", "fixed"] }).notNull().default("fixed"),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
  profit: numeric("profit", { precision: 12, scale: 2 }).notNull().default("0"),
  warrantyPeriod: text("warranty_period"),                    // "7d"|"1m"|"3m"|"6m"|"custom"|null
  warrantyCustomDays: integer("warranty_custom_days"),        // used when warrantyPeriod="custom"
  warrantyExpiryDate: timestamp("warranty_expiry_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Product Price History ─────────────────────────────────────────────────────

export const productPriceHistoryTable = pgTable("product_price_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: integer("product_id").notNull(),
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }),
  salePrice: numeric("sale_price", { precision: 12, scale: 2 }),
  billId: integer("bill_id"),                                 // nullable FK to purchase_bills
  source: text("source").notNull().default("purchase"),       // "purchase"|"manual"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductPriceHistory = typeof productPriceHistoryTable.$inferSelect;

// ─── Product Returns ───────────────────────────────────────────────────────────

export const productReturnsTable = pgTable("product_returns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  saleId: integer("sale_id"),             // original sale reference (optional)
  productId: integer("product_id").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  returnAmount: numeric("return_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  profitReversed: numeric("profit_reversed", { precision: 12, scale: 2 }).notNull().default("0"),
  reason: text("reason"),
  isResalable: boolean("is_resalable").notNull().default(false),
  paymentMethod: text("payment_method", { enum: ["cash", "digital"] }).notNull().default("cash"),
  returnDate: timestamp("return_date", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Company Replacements ─────────────────────────────────────────────────────

export const companyReplacementsTable = pgTable("company_replacements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: integer("product_id").notNull(),
  companyId: integer("company_id"),
  companyName: text("company_name").notNull(),
  sentQty: numeric("sent_qty", { precision: 12, scale: 3 }).notNull(),
  receivedQty: numeric("received_qty", { precision: 12, scale: 3 }).notNull().default("0"),
  dateSent: timestamp("date_sent", { withTimezone: true }).notNull(),
  faultReason: text("fault_reason").notNull(),
  customerName: text("customer_name"),
  referenceNo: text("reference_no"),
  status: text("status", {
    enum: ["pending", "partially_received", "completed", "rejected"],
  }).notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Replacement Receives (partial receive history) ────────────────────────────

export const replacementReceivesTable = pgTable("replacement_receives", {
  id: serial("id").primaryKey(),
  replacementId: integer("replacement_id").notNull(),
  receivedQty: numeric("received_qty", { precision: 12, scale: 3 }).notNull(),
  receiveDate: timestamp("receive_date", { withTimezone: true }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Stock Adjustments ────────────────────────────────────────────────────────

export const stockAdjustmentsTable = pgTable("stock_adjustments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: integer("product_id").notNull(),
  adjustmentType: text("adjustment_type", {
    enum: ["damaged", "lost", "expired", "broken", "personal_use", "manual_add", "manual_remove"],
  }).notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(), // positive = add, negative = remove
  reason: text("reason"),
  adjustmentDate: timestamp("adjustment_date", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Supplier Payments ────────────────────────────────────────────────────────

export const supplierPaymentsTable = pgTable("supplier_payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  companyId: integer("company_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method", { enum: ["cash", "digital"] }).notNull().default("cash"),
  billId: integer("bill_id"),               // optional FK → purchase_bills.id
  paymentDate: timestamp("payment_date", { withTimezone: true }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Sale Edit / Cancel History ───────────────────────────────────────────────

export const saleEditHistoryTable = pgTable("sale_edit_history", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull(),
  userId: integer("user_id").notNull(),
  editType: text("edit_type", { enum: ["edit", "cancel"] }).notNull(),
  oldValues: text("old_values"),           // JSON string
  newValues: text("new_values"),           // JSON string
  editedByName: text("edited_by_name"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Staff Permissions ────────────────────────────────────────────────────────

export const staffPermissionsTable = pgTable("staff_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  canSeePurchasePrice: boolean("can_see_purchase_price").notNull().default(false),
  canSeeProfit: boolean("can_see_profit").notNull().default(false),
  canSeePurchaseBills: boolean("can_see_purchase_bills").notNull().default(false),
  canEditDeleteSale: boolean("can_edit_delete_sale").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Inventory PIN Security ───────────────────────────────────────────────────

export const inventoryPinSettingsTable = pgTable("inventory_pin_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  pinHash: text("pin_hash"),                          // bcrypt hash of 4-digit PIN
  protectedPages: text("protected_pages").notNull().default("[]"), // JSON array of page keys
  unlockDuration: integer("unlock_duration").notNull().default(10), // minutes
  pinResetToken: text("pin_reset_token"),              // 6-digit OTP
  pinResetTokenExpiry: timestamp("pin_reset_token_expiry", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type InventoryPinSettings = typeof inventoryPinSettingsTable.$inferSelect;

// ─── Bill Settings ─────────────────────────────────────────────────────────────

export const billSettingsTable = pgTable("bill_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  shopName: text("shop_name").notNull().default(""),
  address: text("address").notNull().default(""),
  mobile: text("mobile").notNull().default(""),
  logo: text("logo"),                     // base64 or URL
  footer: text("footer").notNull().default(""),
  quickProductShortcut: text("quick_product_shortcut"),       // e.g. "99" or "QP"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Mobile Purchases ──────────────────────────────────────────────────────────

export const mobilePurchasesTable = pgTable("mobile_purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  // Seller info (who we bought from)
  sellerName: text("seller_name").notNull(),
  sellerPhone: text("seller_phone"),
  sellerAddress: text("seller_address"),
  // Mobile details
  imei: text("imei"),    // IMEI 1
  imei2: text("imei2"),  // IMEI 2 (dual SIM)
  mobileModel: text("mobile_model").notNull(),
  company: text("company").notNull(),
  color: text("color"),
  storageCapacity: text("storage_capacity"),
  condition: text("condition", { enum: ["new", "used", "refurbished"] }).notNull().default("used"),
  // Where this mobile came from: "company" (normal supplier) or "person" (seller phone / individual).
  // Person-sourced profit shows only in Mobile Purchase reports, NOT in overall profits.
  purchaseSource: text("purchase_source", { enum: ["company", "person"] }).notNull().default("company"),
  // Ledger entry created when sold (company-sourced only) — for cleanup on return-to-stock
  entryId: integer("entry_id"),
  // Supplier credit (udhaar) created when purchased on credit — links to credits.id for cleanup/sync
  creditId: integer("credit_id"),
  // Prices
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }).notNull().default("0"),
  salePrice: numeric("sale_price", { precision: 12, scale: 2 }).notNull().default("0"),
  // Status
  status: text("status", { enum: ["in_stock", "sold"] }).notNull().default("in_stock"),
  purchaseDate: timestamp("purchase_date", { withTimezone: true }).notNull().defaultNow(),
  // Sale info (filled when sold)
  soldAt: timestamp("sold_at", { withTimezone: true }),
  soldToName: text("sold_to_name"),
  soldToPhone: text("sold_to_phone"),
  saleAmount: numeric("sale_amount", { precision: 12, scale: 2 }),
  paymentMethod: text("payment_method", { enum: ["cash", "digital"] }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Insert Schemas & Types ────────────────────────────────────────────────────

export const insertCompanySchema = createInsertSchema(companiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCollectionSchema = createInsertSchema(productCollectionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPurchaseBillSchema = createInsertSchema(purchaseBillsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPurchaseBillItemSchema = createInsertSchema(purchaseBillItemsTable).omit({ id: true, createdAt: true });
export const insertProductSaleSchema = createInsertSchema(productSalesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductSaleItemSchema = createInsertSchema(productSaleItemsTable).omit({ id: true, createdAt: true });
export const insertProductReturnSchema = createInsertSchema(productReturnsTable).omit({ id: true, createdAt: true });
export const insertBillSettingsSchema = createInsertSchema(billSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCompanyReplacementSchema = createInsertSchema(companyReplacementsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReplacementReceiveSchema = createInsertSchema(replacementReceivesTable).omit({ id: true, createdAt: true });
export const insertStockAdjustmentSchema = createInsertSchema(stockAdjustmentsTable).omit({ id: true, createdAt: true });
export const insertSupplierPaymentSchema = createInsertSchema(supplierPaymentsTable).omit({ id: true, createdAt: true });
export const insertSaleEditHistorySchema = createInsertSchema(saleEditHistoryTable).omit({ id: true, createdAt: true });
export const insertStaffPermissionsSchema = createInsertSchema(staffPermissionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMobilePurchaseSchema = createInsertSchema(mobilePurchasesTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Company = typeof companiesTable.$inferSelect;
export type Category = typeof categoriesTable.$inferSelect;
export type ProductCollection = typeof productCollectionsTable.$inferSelect;
export type Product = typeof productsTable.$inferSelect;
export type PurchaseBill = typeof purchaseBillsTable.$inferSelect;
export type PurchaseBillItem = typeof purchaseBillItemsTable.$inferSelect;
export type ProductSale = typeof productSalesTable.$inferSelect;
export type ProductSaleItem = typeof productSaleItemsTable.$inferSelect;
export type ProductReturn = typeof productReturnsTable.$inferSelect;
export type BillSettings = typeof billSettingsTable.$inferSelect;
export type CompanyReplacement = typeof companyReplacementsTable.$inferSelect;
export type ReplacementReceive = typeof replacementReceivesTable.$inferSelect;
export type StockAdjustment = typeof stockAdjustmentsTable.$inferSelect;
export type SupplierPayment = typeof supplierPaymentsTable.$inferSelect;
export type SaleEditHistory = typeof saleEditHistoryTable.$inferSelect;
export type StaffPermission = typeof staffPermissionsTable.$inferSelect;
