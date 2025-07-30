import express from "express";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import realEstateRoutes from "./routes/realEstate.routes.js";
import pdfReportRoutes from "./routes/pdfReport.routes.js";
import connectDB from "./config/database.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

if (process.env.NODE_ENV === "production") {
  console.log = () => {};
}

const startServer = async () => {
  try {
    await connectDB();

    app.use(express.json({ limit: "1024mb" }));
    app.use(express.urlencoded({ extended: true, limit: "1024mb" }));
    app.use(express.static("public"));

    app.use("/api/auth", authRoutes);
    app.use("/api/user", userRoutes);
    app.use("/api/real-estate", realEstateRoutes);
    app.use("/api/reports", pdfReportRoutes);

    app.listen(port, () => {
      console.log(`Server running at https://clearvalue.co.uk`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
