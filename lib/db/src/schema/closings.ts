import { pgTable, text, serial, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const closingsTable = pgTable("closings", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  source: text("source", { enum: ["cash", "digital"] }).notNull().default("cash"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClosingSchema = createInsertSchema(closingsTable).omit({ id: true, createdAt: true });
export type InsertClosing = z.infer<typeof insertClosingSchema>;
export type Closing = typeof closingsTable.$inferSelect;
