import { pgTable, text, serial, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const entriesTable = pgTable("entries", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull(),
  type: text("type", { enum: ["cash_in", "cash_out"] }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  paymentMethod: text("payment_method", { enum: ["cash", "digital"] }).notNull().default("cash"),
  profit: numeric("profit", { precision: 12, scale: 2 }),
  isCredit: boolean("is_credit").notNull().default(false),
  customerName: text("customer_name"),
  contactNumber: text("contact_number"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  entryDate: timestamp("entry_date", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEntrySchema = createInsertSchema(entriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEntry = z.infer<typeof insertEntrySchema>;
export type Entry = typeof entriesTable.$inferSelect;
