import express, { Request, Response } from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req: Request, res: Response) => {
  res.send("server is running.");
});

// Telegram Auth API
app.use("/api/auth", authRoutes);

export default app;
