import { check, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyUsersTable = pgTable("daily_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("daily_users_email_normalized", sql`${table.email} = lower(btrim(${table.email}))`),
]);

export const insertDailyUserSchema = createInsertSchema(dailyUsersTable).omit({ createdAt: true });
export type InsertDailyUser = z.infer<typeof insertDailyUserSchema>;
export type DailyUser = typeof dailyUsersTable.$inferSelect;