import bcryptjs from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export const hashPassword = async (password) => bcryptjs.hash(password, 12);

export const verifyPassword = async (password, hash) => bcryptjs.compare(password, hash);

export const createAccessToken = (user) => {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

export const verifyAccessToken = (token) => {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  return jwt.verify(token, JWT_SECRET);
};

export const createRandomToken = () => crypto.randomBytes(32).toString("base64url");

export const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
