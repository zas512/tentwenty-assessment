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
app.use((_, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

process.on("unhandledRejection", (err) => {
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  process.exit(1);
});

const start = async () => {
  await connectDB();
  app.listen(5000, () => console.log("Server running on port 5000"));
};

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
