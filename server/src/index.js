import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import errorHandler from "./middleware/errorHandler.js";

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security & parsing middleware ──
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ──
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Health check ──
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Kalyan Chemist API is running",
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ──
app.use("/api/auth", authRoutes);

// ── 404 handler ──
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// ── Global error handler ──
app.use(errorHandler);

// ── Start server ──
app.listen(PORT, () => {
  console.log(`\n🏥 Kalyan Chemist API Server`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});

export default app;
