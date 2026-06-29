import { NextFunction, Request, Response } from "express";

export const apiLogger = (req: Request, res: Response, next: NextFunction) => {
  res.on("finish", () => {
    const method = req.method;
    const path = req.originalUrl || req.url;
    const status = res.statusCode;
    console.log(`${method} ${path} ${status}`);
  });
  next();
};
