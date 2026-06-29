import { Router } from "express";
import {
  getAllUsers,
  updateUserRole,
  getMyHistory,
  getInProgressContests,
  getMyPrizes
} from "../controllers/user.controller";
import { authenticate } from "../middlewares/auth";
import { authorizeRoles } from "../middlewares/authorize";

const router = Router();

router.get("/", authenticate, authorizeRoles("ADMIN"), getAllUsers);
router.patch(
  "/:id/role",
  authenticate,
  authorizeRoles("ADMIN"),
  updateUserRole
);
router.get(
  "/me/history",
  authenticate,
  authorizeRoles("ADMIN", "VIP", "USER", "GUEST"),
  getMyHistory
);
router.get(
  "/me/history/inprogress",
  authenticate,
  authorizeRoles("ADMIN", "VIP", "USER", "GUEST"),
  getInProgressContests
);
router.get(
  "/me/prizes",
  authenticate,
  authorizeRoles("ADMIN", "VIP", "USER", "GUEST"),
  getMyPrizes
);

export default router;
