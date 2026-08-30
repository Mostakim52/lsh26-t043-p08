import { Router } from "express";

import authRouter from "./auth.js";
import resultsRouter from "./results.js";
import studentsRouter from "./students.js";

const router = Router();
router.use(authRouter);
router.use(resultsRouter);
router.use(studentsRouter);

export default router;
