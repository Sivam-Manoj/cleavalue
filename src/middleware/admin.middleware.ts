import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export interface AdminAuthRequest extends Request {
  userId?: string;
  user?: any;
}

export const adminProtect = async (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; role?: string };
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }
    if ((user as any).isBlocked) {
      return res.status(403).json({ message: "Account is blocked" });
    }
    if (user.role !== "admin" && user.role !== "superadmin") {
      return res.status(403).json({ message: "Admin privileges required" });
    }
    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

export const requireSuperadmin = (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  const role = (req.user as any)?.role;
  if (role !== "superadmin") {
    return res.status(403).json({ message: "Superadmin privileges required" });
  }
  next();
};
