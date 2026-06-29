import { Request, Response, NextFunction } from "express";
import { Role } from "../prisma/client";

export const authorizeRoles =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role as Role)) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }
    next();
  };
