import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import {
  seedSuperAdmin,
  validateAdminCredentials,
  listAdmins,
  createAdmin,
  deleteAdminById,
  setAdminBlocked,
} from "../service/adminService.js";
import PdfReport from "../models/pdfReport.model.js";
import { sendEmail } from "../utils/sendVerificationEmail.js";

export const seed = async (req: Request, res: Response) => {
  try {
    const { seedKey, email, password, username, companyName } = req.body || {};
    /*
    // Users (for admin/superadmin)
    // -------------------------
    */
    const requiredKey = process.env.ADMIN_SEED_KEY;
    if (requiredKey && seedKey !== requiredKey) {
      return res.status(403).json({ message: "Invalid seed key" });
    }
    const result = await seedSuperAdmin({
      email,
      password,
      username,
      companyName,
    });
    return res.status(200).json({
      message: result.created ? "Superadmin created" : "Superadmin ensured",
      email: result.email,
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({ message: err?.message || "Failed to seed superadmin" });
  }
};

export const getMonthlyStats = async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1); // first day next month
    const start = new Date(end);
    start.setMonth(start.getMonth() - 12);

    const makeMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const months: string[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < 12; i++) {
      months.push(makeMonthKey(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Aggregate unique reports (grouped by underlying report) by month and type
    const reportsAgg = await (PdfReport as any).aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      { $project: { createdAt: 1, reportType: 1, grp: { $ifNull: ["$report", "$_id"] } } },
      {
        $group: {
          _id: {
            m: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            t: "$reportType",
            r: "$grp",
          },
          c: { $sum: 1 },
        },
      },
      { $group: { _id: { m: "$_id.m", t: "$_id.t" }, c: { $sum: 1 } } },
    ]);

    const usersAgg = await (User as any).aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { m: { $dateToString: { format: "%Y-%m", date: "$createdAt" } } },
          c: { $sum: 1 },
        },
      },
    ]);

    const byTypeKeys = ["Asset", "RealEstate", "Salvage"] as const;
    const reportsByType: Record<typeof byTypeKeys[number], number[]> = {
      Asset: Array(12).fill(0),
      RealEstate: Array(12).fill(0),
      Salvage: Array(12).fill(0),
    };
    const reportTotals = Array(12).fill(0);

    for (const r of reportsAgg) {
      const idx = months.indexOf(r._id?.m);
      if (idx >= 0) {
        const t = r._id?.t || "";
        if (t in reportsByType) {
          reportsByType[t as keyof typeof reportsByType][idx] += r.c;
        }
        reportTotals[idx] += r.c;
      }
    }

    const userTotals = Array(12).fill(0);
    for (const u of usersAgg) {
      const idx = months.indexOf(u._id?.m);
      if (idx >= 0) userTotals[idx] = u.c;
    }

    const lastIdx = months.length - 1;
    const prevIdx = months.length - 2;
    const reportsNow = reportTotals[lastIdx] || 0;
    const reportsPrev = reportTotals[prevIdx] || 0;
    const usersNow = userTotals[lastIdx] || 0;
    const usersPrev = userTotals[prevIdx] || 0;

    const pct = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : 100) : ((a - b) / b) * 100);

    return res.status(200).json({
      months,
      reports: {
        totals: reportTotals,
        byType: reportsByType,
      },
      users: {
        totals: userTotals,
      },
      deltas: {
        reports: { total: reportsNow, delta: reportsNow - reportsPrev, percent: pct(reportsNow, reportsPrev) },
        users: { total: usersNow, delta: usersNow - usersPrev, percent: pct(usersNow, usersPrev) },
      },
    });
  } catch (e) {
    console.error("getMonthlyStats error", e);
    return res.status(500).json({ message: "Failed to fetch monthly stats" });
  }
};

export const getAdminStats = async (_req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      totalAdmins,
      totalReports,
      assetReports,
      realEstateReports,
      salvageReports,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: { $in: ["admin", "superadmin"] } }),
      (PdfReport as any)
        .aggregate([{ $group: { _id: { $ifNull: ["$report", "$_id"] } } }, { $count: "count" }])
        .then((a: any[]) => (a?.[0]?.count || 0)),
      (PdfReport as any)
        .aggregate([{ $match: { reportType: "Asset" } }, { $group: { _id: { $ifNull: ["$report", "$_id"] } } }, { $count: "count" }])
        .then((a: any[]) => (a?.[0]?.count || 0)),
      (PdfReport as any)
        .aggregate([{ $match: { reportType: "RealEstate" } }, { $group: { _id: { $ifNull: ["$report", "$_id"] } } }, { $count: "count" }])
        .then((a: any[]) => (a?.[0]?.count || 0)),
      (PdfReport as any)
        .aggregate([{ $match: { reportType: "Salvage" } }, { $group: { _id: { $ifNull: ["$report", "$_id"] } } }, { $count: "count" }])
        .then((a: any[]) => (a?.[0]?.count || 0)),
    ]);

    return res.status(200).json({
      totalUsers,
      totalAdmins,
      totalReports,
      byType: {
        Asset: assetReports,
        RealEstate: realEstateReports,
        Salvage: salvageReports,
      },
    });
  } catch (e) {
    console.error("getAdminStats error", e);
    return res.status(500).json({ message: "Failed to fetch stats" });
  }
};

// -------------------------
// Users (for admin/superadmin)
// -------------------------
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { q, from, to, isBlocked } = req.query as Record<string, string | undefined>;
    const page = Math.max(parseInt((req.query.page as string) || "1", 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "20", 10) || 20, 1), 100);

    const filter: any = { role: "user" };
    if (q) {
      const regex = new RegExp(q, "i");
      filter.$or = [{ email: regex }, { username: regex }, { companyName: regex }];
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    if (typeof isBlocked !== "undefined") {
      if (isBlocked === "true" || isBlocked === "false") {
        filter.isBlocked = isBlocked === "true";
      }
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .select("email username companyName contactEmail contactPhone companyAddress role isBlocked isVerified createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({ items, total, page, limit });
  } catch (e) {
    console.error("getUsers error", e);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
};

export const blockUserByAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as any;
    const { blocked } = req.body || {};
    if (typeof blocked !== "boolean") {
      return res.status(400).json({ message: "blocked must be boolean" });
    }
    const user = await User.findById(id).select("role isBlocked");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role !== "user") {
      return res.status(403).json({ message: "Cannot change block status for admin accounts here" });
    }
    user.isBlocked = blocked as any;
    await user.save();
    const safe = await User.findById(id).select("email username companyName contactEmail contactPhone companyAddress role isBlocked isVerified createdAt");
    return res.status(200).json({ user: safe });
  } catch (e) {
    const msg = (e as any)?.message || "Failed to update block status";
    return res.status(400).json({ message: msg });
  }
};

export const deleteUserByAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as any;
    const user = await User.findById(id).select("role");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role !== "user") {
      return res.status(403).json({ message: "Cannot delete admin accounts here" });
    }
    await User.deleteOne({ _id: id });
    return res.status(204).send();
  } catch (e) {
    const msg = (e as any)?.message || "Failed to delete user";
    return res.status(400).json({ message: msg });
  }
};

export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await validateAdminCredentials(email, password);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET!,
      {
        expiresIn: "30m",
      }
    );
    const refreshToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_REFRESH_SECRET!,
      {
        expiresIn: "7d",
      }
    );

    // Do not persist admin refresh tokens in DB for now (reuse user controller if needed)
    // Return sanitized user payload
    const safeUser = await User.findById(user._id).select(
      "-password -refreshTokens -refreshToken"
    );
    return res.status(200).json({ accessToken, refreshToken, user: safeUser });
  } catch (err) {
    return res.status(500).json({ message: "Failed to login" });
  }
};

export const refreshAdminToken = async (req: Request, res: Response) => {
  try {
    // Accept refresh token via header or body
    const headerToken = req.headers["x-refresh-token"] as string | undefined;
    const bodyToken = (req.body as any)?.refreshToken as string | undefined;
    const refreshToken = (headerToken || bodyToken || "").trim();
    if (!refreshToken) {
      return res.status(401).json({ message: "Missing refresh token" });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
    } catch {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ message: "User not found" });
    if ((user as any).isBlocked)
      return res.status(403).json({ message: "Account is blocked" });
    if (user.role !== "admin" && user.role !== "superadmin")
      return res.status(403).json({ message: "Admin privileges required" });

    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "30m" }
    );

    return res.status(200).json({ accessToken });
  } catch (e) {
    return res.status(500).json({ message: "Failed to refresh token" });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer "))
      return res.status(401).json({ message: "No token" });
    const token = auth.split(" ")[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const user = await User.findById(decoded.id).select(
      "-password -refreshTokens -refreshToken"
    );
    if (!user) return res.status(401).json({ message: "Invalid token" });
    if ((user as any).isBlocked)
      return res.status(403).json({ message: "Account is blocked" });
    return res.status(200).json({ user });
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const getAdmins = async (_req: Request, res: Response) => {
  const admins = await listAdmins();
  return res.status(200).json({ admins });
};

export const postAdmin = async (req: Request, res: Response) => {
  try {
    const { email, username, password, companyName } = req.body || {};
    if (!email) return res.status(400).json({ message: "Email is required" });
    const user = await createAdmin({ email, username, password, companyName });
    const safe = await User.findById(user._id).select(
      "-password -refreshTokens -refreshToken"
    );
    return res.status(201).json({ user: safe });
  } catch (e: any) {
    return res
      .status(400)
      .json({ message: e?.message || "Failed to create admin" });
  }
};

export const deleteAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as any;
    await deleteAdminById(id);
    return res.status(204).send();
  } catch (e: any) {
    const msg = e?.message || "Failed to delete admin";
    const code = msg.includes("superadmin") ? 403 : 400;
    return res.status(code).json({ message: msg });
  }
};

export const blockAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as any;
    const { blocked } = req.body || {};
    if (typeof blocked !== "boolean") {
      return res.status(400).json({ message: "blocked must be boolean" });
    }
    const user = await setAdminBlocked(id, blocked);
    const safe = await User.findById(user._id).select(
      "-password -refreshTokens -refreshToken"
    );
    return res.status(200).json({ user: safe });
  } catch (e: any) {
    const msg = e?.message || "Failed to update block status";
    const code = msg.includes("superadmin") ? 403 : 400;
    return res.status(code).json({ message: msg });
  }
};

export const getAdminReports = async (req: Request, res: Response) => {
  try {
    const { q, reportType, from, to, userEmail } = req.query as Record<
      string,
      string | undefined
    >;
    const page = Math.max(
      parseInt((req.query.page as string) || "1", 10) || 1,
      1
    );
    const limit = Math.min(
      Math.max(parseInt((req.query.limit as string) || "20", 10) || 20, 1),
      100
    );

    const filter: any = {};
    if (q) {
      const regex = new RegExp(q, "i");
      filter.$or = [{ filename: regex }, { address: regex }];
    }
    if (reportType) {
      filter.reportType = reportType;
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    if (userEmail) {
      const users = await User.find({
        email: new RegExp(userEmail, "i"),
      }).select("_id");
      if (users.length) {
        filter.user = { $in: users.map((u) => u._id) };
      } else {
        return res.status(200).json({ items: [], total: 0, page, limit });
      }
    }

    // First, get unique report groups with pagination
    const groupsAgg = await (PdfReport as any).aggregate([
      { $match: filter },
      { $group: { _id: { $ifNull: ["$report", "$_id"] }, maxCreatedAt: { $max: "$createdAt" } } },
      { $sort: { maxCreatedAt: -1 } },
      { $facet: {
        total: [{ $count: "count" }],
        groups: [
          { $skip: (page - 1) * limit },
          { $limit: limit }
        ]
      }}
    ]);

    const total = groupsAgg?.[0]?.total?.[0]?.count || 0;
    const reportIds = (groupsAgg?.[0]?.groups || []).map((g: any) => g._id);

    // Then fetch all records for these report groups
    const items = reportIds.length > 0 ? await PdfReport.find({
      ...filter,
      $or: reportIds.map((id: any) => id ? { report: id } : { _id: id, report: { $exists: false } })
    })
      .populate("user", "email username")
      .sort({ createdAt: -1 }) : [];

    return res.status(200).json({ items, total, page, limit });
  } catch (e) {
    console.error("getAdminReports error", e);
    return res.status(500).json({ message: "Failed to fetch reports" });
  }
};
