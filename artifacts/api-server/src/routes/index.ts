import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import entriesRouter from "./entries";
import creditsRouter from "./credits";
import customersRouter from "./customers";
import reportsRouter from "./reports";
import backupRouter from "./backup";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(entriesRouter);
router.use(creditsRouter);
router.use(customersRouter);
router.use(reportsRouter);
router.use(backupRouter);

export default router;
