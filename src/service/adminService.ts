import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { sendEmail } from "../utils/sendVerificationEmail.js";

export interface SeedResult {
  created: boolean;
  email: string;
}

export const seedSuperAdmin = async (params?: {
  email?: string;
  password?: string;
  username?: string;
  companyName?: string;
}) => {
  const email = params?.email || process.env.SUPERADMIN_EMAIL;
  const password = params?.password || process.env.SUPERADMIN_PASSWORD;
  const username = params?.username || "superadmin";
  const companyName = params?.companyName || process.env.SUPERADMIN_COMPANY || "ClearValue";

  if (!email || !password) {
    throw new Error("Missing SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD");
  }

  let user = await User.findOne({ email });
  if (user) {
    // Ensure role and verification are correct
    if (user.role !== "superadmin") {
      user.role = "superadmin" as any;
    }
    if (!user.isVerified) {
      user.isVerified = true;
    }
    await user.save();
    return { created: false, email } as SeedResult;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  user = new User({
    email,
    password: hashedPassword,
    username,
    companyName,
    role: "superadmin",
    isVerified: true,
    authProvider: "email",
  } as any);

  await user.save();
  return { created: true, email } as SeedResult;
};

export const validateAdminCredentials = async (email: string, password: string) => {
  const user = await User.findOne({ email }).select("+password role isVerified");
  if (!user) return null;
  if (!user.password) return null;
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return null;
  if (!user.isVerified) return null;
  if (user.role !== "admin" && user.role !== "superadmin") return null;
  if ((user as any).isBlocked) return null;
  return user;
};

export const listAdmins = async () => {
  return User.find({ role: { $in: ["admin", "superadmin"] } }).select("-password -refreshTokens -refreshToken").sort({ role: 1, createdAt: -1 });
};

export const createAdmin = async (params: { email: string; username?: string; password?: string; companyName?: string; }) => {
  const { email } = params;
  const exists = await User.findOne({ email });
  if (exists) {
    throw new Error("User with this email already exists");
  }
  const password = params.password || Math.random().toString(36).slice(-10) + "A1";
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = new User({
    email,
    username: params.username || email.split("@")[0],
    companyName: params.companyName,
    role: "admin",
    isVerified: true,
    isBlocked: false,
    password: hashedPassword,
    authProvider: "email",
  } as any);
  await user.save();

  const html = `
    <div style="font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="color:#e11d48;margin:0 0 12px">Welcome to ClearValue Admin</h2>
      <p>You have been granted admin access.</p>
      <p><strong>Login URL:</strong> ${process.env.ADMIN_APP_URL || "http://localhost:3001"}/login</p>
      <p><strong>Email:</strong> ${email}<br/>
         <strong>Temporary Password:</strong> ${password}</p>
      <p>Please sign in and change your password if needed.</p>
    </div>`;
  try {
    await sendEmail(email, "Your ClearValue Admin Access", html);
  } catch (e) {
    // Log and proceed; admin can resend later
    console.error("Failed to send admin invite email:", e);
  }
  return user;
};

export const deleteAdminById = async (id: string) => {
  const user = await User.findById(id);
  if (!user) throw new Error("User not found");
  if (user.role === "superadmin") throw new Error("Cannot delete superadmin");
  await User.findByIdAndDelete(id);
};

export const setAdminBlocked = async (id: string, blocked: boolean) => {
  const user = await User.findById(id);
  if (!user) throw new Error("User not found");
  if (user.role === "superadmin") throw new Error("Cannot block superadmin");
  user.set("isBlocked", blocked);
  await user.save();
  return user;
};
