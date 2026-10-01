import { jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import type { Store } from "@workspace/daily-model";
import { dailyWorkspacesTable } from "./daily-workspaces";

export const dailyMutationsTable = pgTable("daily_mutations", {
  ownerId: text("owner_id").notNull().references(() => dailyWorkspacesTable.ownerId, { onDelete: "cascade" }),
  mutationId: text("mutation_id").notNull(),
  requestHash: text("request_hash").notNull(),
  // Keep the exact committed result, not a pointer to a mutable workspace.
  snapshot: jsonb("snapshot").$type<{ workspace: Store; revision: number; updatedAt: string }>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.ownerId, table.mutationId] }),
]);

export const insertDailyMutationSchema = createInsertSchema(dailyMutationsTable).omit({ createdAt: true });
export type InsertDailyMutation = z.infer<typeof insertDailyMutationSchema>;
export type DailyMutation = typeof dailyMutationsTable.$inferSelect;