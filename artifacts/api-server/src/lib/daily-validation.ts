import { z } from "zod";
import { LoginDailyAccountBody, RegisterDailyAccountBody, SaveDailyWorkspaceBody } from "@workspace/api-zod";
import { storeSchema } from "@workspace/daily-model";
import { DailyError } from "./daily-errors";

const email = z.string().trim().toLowerCase().min(3).max(254).email();
export const registrationSchema = RegisterDailyAccountBody.extend({
  email,
  name: z.string().trim().min(1).max(60),
}).strict();
export const credentialsSchema = LoginDailyAccountBody.extend({ email }).strict();

export function validateWorkspaceInput(value: unknown) {
  const envelope = SaveDailyWorkspaceBody.strict().safeParse(value);
  if (!envelope.success) throw new DailyError(400, "Invalid workspace input. Check record limits, amounts, dates, and revision.");
  const parsed = storeSchema.safeParse(envelope.data.workspace);
  if (!parsed.success) throw new DailyError(400, "Invalid workspace: inconsistent references, duplicate records, dates, or rates.");
  const workspace = { ...parsed.data, entered: true };
  const shifts = [...workspace.sessions, ...(workspace.active ? [workspace.active] : [])];
  if (shifts.some(shift => shift.overtime < shift.normal)) {
    throw new DailyError(400, "Overtime rates cannot be lower than normal rates.");
  }
  // Prevent exceptionally large spans from exhausting per-day calculations.
  if (workspace.sessions.some(shift => shift.end - shift.start > 366 * 86400000)) {
    throw new DailyError(400, "A completed shift cannot exceed 366 days.");
  }
  return { workspace, revision: envelope.data.revision, mutationId: envelope.data.mutationId };
}