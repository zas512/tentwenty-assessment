import { NextFunction, Request, Response } from "express";

export const apiLogger = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const endedAt = process.hrtime.bigint();
    const durationMs = Number(endedAt - startedAt) / 1_000_000;
    const method = req.method;
    const path = req.originalUrl || req.url;
    const status = res.statusCode;
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    console.log(
      `${method} ${path} ${status} ${durationMs.toFixed(2)}ms ip=${ip}`
    );
  });

  next();
};
