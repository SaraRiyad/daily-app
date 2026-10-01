import { check, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import type { Store } from "@workspace/daily-model";
import { dailyUsersTable } from "./daily-users";

export const dailyWorkspacesTable = pgTable("daily_workspaces", {
  ownerId: text("owner_id").primaryKey().references(() => dailyUsersTable.id, { onDelete: "cascade" }),
  workspace: jsonb("workspace").$type<Store>().notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("daily_workspaces_revision_nonnegative", sql`${table.revision} >= 0`),
  check("daily_workspaces_version", sql`${table.workspace}->>'version' = '1'`),
]);

export const insertDailyWorkspaceSchema = createInsertSchema(dailyWorkspacesTable).omit({ updatedAt: true });
export type InsertDailyWorkspace = z.infer<typeof insertDailyWorkspaceSchema>;
export type DailyWorkspace = typeof dailyWorkspacesTable.$inferSelect;