import { NextFunction, Request, Response } from "express";
import { RateLimiterMemory } from "rate-limiter-flexible";

const rateLimiter = new RateLimiterMemory({
  points: 100,
  duration: 15 * 60
});

export const rateLimit = (req: Request, res: Response, next: NextFunction) => {
  rateLimiter
    .consume(req.ip ?? req.socket.remoteAddress ?? "unknown")
    .then(() => {
      next();
    })
    .catch(() => {
      res.status(429).send("Too Many Requests");
    });
};
