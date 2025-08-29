import express from "express";
import fs from "fs/promises";
import path from "path";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import realEstateRoutes from "./routes/realEstate.routes.js";
import salvageRoutes from "./routes/salvage.routes.js";
import assetRoutes from "./routes/asset.routes.js";
import pdfReportRoutes from "./routes/pdfReport.routes.js";
import connectDB from "./config/database.js";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// if (process.env.NODE_ENV === "production") {
//   console.log = () => {};
// }

const startServer = async () => {
  try {
    await connectDB();

    app.use(express.json({ limit: "1024mb" }));
    app.use(express.urlencoded({ extended: true, limit: "1024mb" }));
    app.use(express.static("public"));
    // Serve generated PDF reports
    app.use("/reports", express.static("reports"));

    // Ensure uploads directory exists (covers varied working directories)
    try {
      await fs.mkdir(path.resolve(process.cwd(), "uploads"), { recursive: true });
    } catch {}

    if (process.env.NODE_ENV === "development") {
      app.use(
        cors({
          origin: [
            "https://www.clearvalue.site",
            "https://clearvalue.site",
            "http://localhost:3000",
          ],
          credentials: true,
        })
      );
    }

    app.use("/api/auth", authRoutes);
    app.use("/api/user", userRoutes);
    app.use("/api/real-estate", realEstateRoutes);
    app.use("/api/salvage", salvageRoutes);
    app.use("/api/asset", assetRoutes);
    app.use("/api/reports", pdfReportRoutes);

    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
