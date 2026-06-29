import { Router } from "express";
import {
  createContest,
  getContests,
  getContest,
  updateContest,
  deleteContest
} from "../controllers/contest.controller";
import { authenticate } from "../middlewares/auth";
import { authorizeRoles } from "../middlewares/authorize";

const router = Router();

router.get("/", getContests);
router.get("/:id", getContest);
router.post("/", authenticate, authorizeRoles("ADMIN"), createContest);
router.put("/:id", authenticate, authorizeRoles("ADMIN"), updateContest);
router.delete("/:id", authenticate, authorizeRoles("ADMIN"), deleteContest);

export default router;
