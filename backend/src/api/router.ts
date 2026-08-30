import { Router } from "express";

import authRouter from "./auth.js";
import resultsRouter from "./results.js";

const router = Router();
router.use(authRouter);
router.use(resultsRouter);

export default router;
