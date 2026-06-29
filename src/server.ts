import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import corsOptions from "./config/cors";
import { rateLimit } from "./middlewares/rateLimit";
import { connectDB } from "./config/prisma";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import routes from "./routes/index";

const app = express();
const PORT = Number(process.env.PORT ?? 5000);

app.use(cors(corsOptions));
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(cookieParser(process.env.JWT_SECRET));
app.use(rateLimit);

app.get("/", (_, res) => {
  res.status(200).json({ message: "Server working" });
});
app.use("/", routes);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use((_, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled API error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
);

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

const start = async () => {
  await connectDB();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
