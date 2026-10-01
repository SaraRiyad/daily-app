import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dailyUsersTable } from "./daily-users";

export const dailySessionsTable = pgTable("daily_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => dailyUsersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => [
  index("daily_sessions_owner_idx").on(table.ownerId),
  index("daily_sessions_expiry_idx").on(table.expiresAt),
]);

export const insertDailySessionSchema = createInsertSchema(dailySessionsTable).omit({ createdAt: true });
export type InsertDailySession = z.infer<typeof insertDailySessionSchema>;
export type DailySession = typeof dailySessionsTable.$inferSelect;