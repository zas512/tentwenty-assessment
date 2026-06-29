import { Router } from "express";
import {
  joinContest,
  submitContest,
  getLeaderboard
} from "../controllers/participation.controller";
import { authenticate } from "../middlewares/auth";
import { authorizeRoles } from "../middlewares/authorize";

const router = Router();

router.post(
  "/:id/join",
  authenticate,
  authorizeRoles("ADMIN", "VIP", "USER"),
  joinContest
);
router.post(
  "/:id/submit",
  authenticate,
  authorizeRoles("ADMIN", "VIP", "USER"),
  submitContest
);
router.get("/:id/leaderboard", getLeaderboard);

export default router;
