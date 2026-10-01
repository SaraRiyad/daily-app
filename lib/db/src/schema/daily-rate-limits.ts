import { check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyRateLimitsTable = pgTable("daily_rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("daily_rate_limits_expiry_idx").on(table.expiresAt),
  check("daily_rate_limits_attempts_positive", sql`${table.attempts} > 0`),
]);

export const insertDailyRateLimitSchema = createInsertSchema(dailyRateLimitsTable);
export type InsertDailyRateLimit = z.infer<typeof insertDailyRateLimitSchema>;
export type DailyRateLimit = typeof dailyRateLimitsTable.$inferSelect;