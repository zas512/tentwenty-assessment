import { Router } from "express";
import {
  addQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion
} from "../controllers/question.controller";
import { authenticate } from "../middlewares/auth";
import { authorizeRoles } from "../middlewares/authorize";

const router = Router();

router.get("/:id/questions", getQuestions);
router.post(
  "/:id/questions",
  authenticate,
  authorizeRoles("ADMIN"),
  addQuestion
);
router.put(
  "/:id/questions/:questionId",
  authenticate,
  authorizeRoles("ADMIN"),
  updateQuestion
);
router.delete(
  "/:id/questions/:questionId",
  authenticate,
  authorizeRoles("ADMIN"),
  deleteQuestion
);

export default router;
