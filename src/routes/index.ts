import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import contestRoutes from "./contest.routes";
import participationRoutes from "./participation.routes";
import questionRoutes from "./question.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/contest", contestRoutes);
router.use("/participation", participationRoutes);
router.use("/contest", questionRoutes);

export default router;
