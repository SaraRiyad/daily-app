import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import {
  GetDailyAccountResponse,
  GetDailyWorkspaceResponse,
  LoginDailyAccountResponse,
  RegisterDailyAccountResponse,
  SaveDailyWorkspaceResponse,
} from "@workspace/api-zod";
import { DailyError } from "../lib/daily-errors";
import { DailyRepository, type AuthenticatedOwner } from "../lib/daily-repository";
import { bearerTokenHash } from "../lib/daily-security";
import { credentialsSchema, registrationSchema, validateWorkspaceInput } from "../lib/daily-validation";

const repository = new DailyRepository(pool);
const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const input = registrationSchema.safeParse(req.body);
  if (!input.success) throw new DailyError(400, "Enter a valid email, a password of 8–128 characters, and your name (1–60 characters).");
  await repository.throttleAuthentication(req.ip ?? req.socket.remoteAddress ?? "unknown", input.data.email);
  const result = await repository.register(input.data.email, input.data.password, input.data.name);
  res.status(201).json(RegisterDailyAccountResponse.parse(result));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const input = credentialsSchema.safeParse(req.body);
  if (!input.success) throw new DailyError(400, "Enter a valid email and password (8–128 characters).");
  await repository.throttleAuthentication(req.ip ?? req.socket.remoteAddress ?? "unknown", input.data.email);
  const result = await repository.login(input.data.email, input.data.password);
  res.json(LoginDailyAccountResponse.parse(result));
});

// Only the protected Daily routes authenticate. Health remains public.
router.use(["/auth/me", "/auth/logout", "/workspace"], async (req, res, next): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const tokenHash = bearerTokenHash(req.get("authorization"));
  if (!tokenHash) throw new DailyError(401, "Please sign in to access your workspace.");
  res.locals.dailyOwner = await repository.authenticate(tokenHash);
  next();
});

router.get("/auth/me", async (_req, res): Promise<void> => {
  const owner = res.locals.dailyOwner as AuthenticatedOwner;
  res.json(GetDailyAccountResponse.parse(owner.account));
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  await repository.logout(res.locals.dailyOwner as AuthenticatedOwner);
  res.status(204).end();
});

router.get("/workspace", async (_req, res): Promise<void> => {
  const owner = res.locals.dailyOwner as AuthenticatedOwner;
  res.json(GetDailyWorkspaceResponse.parse(await repository.getWorkspace(owner.account.id)));
});

router.put("/workspace", async (req, res): Promise<void> => {
  const input = validateWorkspaceInput(req.body);
  const owner = res.locals.dailyOwner as AuthenticatedOwner;
  res.json(SaveDailyWorkspaceResponse.parse(await repository.saveWorkspace(owner, input)));
});

export default router;