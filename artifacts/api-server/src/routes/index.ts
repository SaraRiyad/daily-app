import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dailyRouter from "./daily";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dailyRouter);

export default router;
