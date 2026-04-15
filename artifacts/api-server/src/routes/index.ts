import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import oauthRouter from "./oauth";
import entriesRouter from "./entries";
import creditsRouter from "./credits";
import customersRouter from "./customers";
import reportsRouter from "./reports";
import backupRouter from "./backup";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(oauthRouter);
router.use(entriesRouter);
router.use(creditsRouter);
router.use(customersRouter);
router.use(reportsRouter);
router.use(backupRouter);
router.use(adminRouter);

export default router;
