import { pgTable, text, serial, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const creditsTable = pgTable("credits", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull(),
  customerName: text("customer_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  type: text("type", { enum: ["given", "received"] }).notNull(),
  status: text("status", { enum: ["pending", "paid"] }).notNull().default("pending"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCreditSchema = createInsertSchema(creditsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCredit = z.infer<typeof insertCreditSchema>;
export type Credit = typeof creditsTable.$inferSelect;
