import "dotenv/config";
import express from "express";
import { PrismaClient } from "@prisma/client";
import {
  exchangeCodeForTokens,
  fetchAccounts,
  fetchAccountBalance,
  fetchCardTransactions,
  fetchCards,
  fetchCardBalance,
  fetchInfo,
  fetchTransactions,
} from "./lib/truelayer-client.js";
import {
  buildMerchantKey,
  getProviderCategory,
  mapOpenBankingCategory,
  resolveOpenBankingCategory,
} from "./lib/open-banking-category.js";
import {
  createAccessToken,
  createRandomToken,
  hashPassword,
  hashToken,
  verifyAccessToken,
  verifyPassword,
} from "./lib/auth.js";
import { sendEmail } from "./lib/email.js";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8081;
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const OWNER_EMAILS = (process.env.OWNER_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const FEEDBACK_EMAIL = process.env.FEEDBACK_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || "";

app.use(express.json({ limit: "5mb" }));

const parseAmount = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object") {
    return parseAmount(value.amount ?? value.value ?? value.current ?? null);
  }
  return null;
};

const normalizeBalancePayload = (payload) => {
  const entry = Array.isArray(payload) ? payload[0] : payload;
  if (!entry || typeof entry !== "object") return {};
  const balance = parseAmount(entry.current ?? entry.available ?? entry.balance ?? entry.amount);
  const availableBalance = parseAmount(entry.available ?? entry.current ?? null);
  const limit = parseAmount(entry.credit_limit ?? entry.overdraft ?? entry.limit ?? null);
  const result = {};
  if (balance !== null) result.balance = balance;
  if (availableBalance !== null) result.availableBalance = availableBalance;
  if (limit !== null) result.limit = limit;
  return result;
};

const deriveUkAccountDetails = (value) => {
  if (!value) return { accountNumber: null, sortCode: null };
  const raw = String(value).replace(/\s+/g, "");
  const match = raw.match(/^GB\d{2}[A-Z]{4}(\d{6})(\d{8})$/i);
  if (!match) return { accountNumber: null, sortCode: null };
  return { sortCode: match[1], accountNumber: match[2] };
};

const normalizeTypeLabel = (value) => String(value || "").toLowerCase();

const inferAccountType = (acct) => {
  const typeHints = [
    acct.account_type,
    acct.type,
    acct.account_subtype,
    acct.account_sub_type,
    acct.product_code,
    acct.productCode,
    acct.display_name,
    acct.name,
  ]
    .filter(Boolean)
    .map((value) => normalizeTypeLabel(value));
  const joined = typeHints.join(" ");
  if (joined.includes("credit") || joined.includes("card") || joined.includes("cc")) return "card";
  if (joined.includes("overdraft")) return "overdraft";
  return acct.account_type || acct.type || "account";
};

const resolveTransactionCategory = async (tx, userId) => {
  const merchantKey = buildMerchantKey(tx);
  const providerCategory = getProviderCategory(tx);
  const mcc = tx.merchant_category_code ? String(tx.merchant_category_code) : null;

  let rule = null;
  if (merchantKey) {
    rule = await prisma.merchantCategoryRule.findUnique({
      where: { userId_merchantKey: { userId, merchantKey } },
    });
  }

  if (rule?.category) {
    return { category: rule.category, source: rule.source || "manual" };
  }

  const resolved = resolveOpenBankingCategory(tx);
  const mapped = resolved.category;

  if (merchantKey && (providerCategory || mcc || resolved.source === "keyword")) {
    await prisma.merchantCategoryRule.upsert({
      where: { userId_merchantKey: { userId, merchantKey } },
      update: {
        category: mapped,
        source: resolved.source,
      },
      create: {
        userId,
        merchantKey,
        category: mapped,
        source: resolved.source,
      },
    });
  }

  await ensureUserCategory(userId, mapped);
  return { category: mapped, source: resolved.source };
};

const normalizeDateInput = (value, endOfDay = false) => {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (endOfDay) {
      date.setUTCHours(23, 59, 59, 999);
    } else {
      date.setUTCHours(0, 0, 0, 0);
    }
  }
  return date;
};

const normalizeDateRange = (fromDate, toDate) => {
  const from = normalizeDateInput(fromDate, false);
  const to = normalizeDateInput(toDate, true);
  return { from, to };
};

const ensureUserDefaultCategories = async (userId) => {
  const defaults = await prisma.category.findMany({
    where: { userId: null },
    include: { subCategories: true },
  });
  if (!defaults.length) return;

  for (const category of defaults) {
    const userCategory = await prisma.category.upsert({
      where: { userId_name: { userId, name: category.name } },
      update: {},
      create: {
        userId,
        name: category.name,
        icon: category.icon,
        color: category.color,
      },
    });

    for (const sub of category.subCategories) {
      const existingSub = await prisma.subCategory.findFirst({
        where: { categoryId: userCategory.id, name: sub.name },
        select: { id: true },
      });
      if (!existingSub) {
        await prisma.subCategory.create({
          data: { categoryId: userCategory.id, name: sub.name },
        });
      }
    }
  }
};

const ensureUserDefaultHeadAccounts = async (userId) => {
  const defaults = await prisma.headAccount.findMany({
    where: { userId: null },
  });
  if (!defaults.length) return;
  for (const head of defaults) {
    await prisma.headAccount.upsert({
      where: { userId_name: { userId, name: head.name } },
      update: {},
      create: { userId, name: head.name },
    });
  }
};

const ensureUserCategory = async (userId, name) => {
  if (!name || typeof name !== "string") return;
  const existing = await prisma.category.findFirst({
    where: { userId, name },
    select: { id: true },
  });
  if (existing) return;

  const template = await prisma.category.findFirst({
    where: { userId: null, name },
    select: { icon: true, color: true },
  });

  await prisma.category.create({
    data: {
      userId,
      name,
      icon: template?.icon || null,
      color: template?.color || null,
    },
  });
};

const ensureHeadAccount = async (userId, name) => {
  if (!name || typeof name !== "string") return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = await prisma.headAccount.findFirst({
    where: { userId, name: trimmed },
    select: { id: true },
  });
  if (existing) return;
  await prisma.headAccount.create({
    data: { userId, name: trimmed },
  });
};

const parseRawJson = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const getManualRawMeta = (raw) => {
  const parsed = parseRawJson(raw);
  if (parsed && parsed.source === "manual") return parsed;
  return null;
};

const buildManualRaw = ({ cardId, transactionType, loanTo, loanFrom }) =>
  JSON.stringify({
    source: "manual",
    cardId: cardId || null,
    transactionType: transactionType || "expense",
    loanTo: loanTo || null,
    loanFrom: loanFrom || null,
  });

const ensureManualConnection = async (userId) => {
  const existing = await prisma.bankConnection.findFirst({
    where: { userId, provider: "manual" },
  });
  if (existing) return existing;
  return prisma.bankConnection.create({
    data: {
      userId,
      provider: "manual",
      providerAccountId: `manual-${userId}`,
      accessToken: "manual",
      refreshToken: null,
      institutionId: null,
      status: "active",
    },
  });
};

const ensureManualAccount = async (userId, { providerAccountId, name, type, mask }) => {
  const existing = await prisma.bankAccount.findFirst({
    where: { userId, providerAccountId },
  });
  if (existing) {
    const updates = {};
    if (typeof name === "string" && name !== existing.name) updates.name = name;
    if (typeof type === "string" && type !== existing.type) updates.type = type;
    if (mask !== undefined && mask !== existing.mask) updates.mask = mask;
    if (Object.keys(updates).length) {
      return prisma.bankAccount.update({
        where: { id: existing.id },
        data: updates,
      });
    }
    return existing;
  }
  const connection = await ensureManualConnection(userId);
  return prisma.bankAccount.create({
    data: {
      userId,
      connectionId: connection.id,
      providerAccountId,
      type: type || "cash",
      name: name || "Manual",
      mask: mask || null,
      status: "active",
    },
  });
};

const resolveManualAccountForTransaction = async (userId, cardId) => {
  if (cardId) {
    const card = await prisma.card.findFirst({ where: { id: cardId, userId } });
    if (!card) return { account: null, card: null };
    const account = await ensureManualAccount(userId, {
      providerAccountId: `manual-card-${card.id}`,
      name: card.name || "Card",
      type: "card",
      mask: card.last4 || null,
    });
    return { account, card };
  }
  const account = await ensureManualAccount(userId, {
    providerAccountId: "manual-cash",
    name: "Cash",
    type: "cash",
    mask: null,
  });
  return { account, card: null };
};
app.use((req, res, next) => {
  const allowedOriginRaw = process.env.CORS_ORIGIN || "*";
  const normalizedAllowed = allowedOriginRaw === "*" ? "*" : allowedOriginRaw.replace(/\/$/, "");
  const requestOrigin = req.headers.origin ? req.headers.origin.replace(/\/$/, "") : "";
  const allowOrigin =
    normalizedAllowed === "*"
      ? "*"
      : requestOrigin && requestOrigin === normalizedAllowed
        ? requestOrigin
        : normalizedAllowed;
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name || null,
  role: user.role,
  emailVerifiedAt: user.emailVerifiedAt,
  createdAt: user.createdAt,
});

const getBearerToken = (req) => {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return null;
};

const requireAuth = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
  }
};

const getOptionalUser = async (req) => {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    return user || null;
  } catch {
    return null;
  }
};

const isAdminUser = (user) => {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (!user.email) return false;
  return OWNER_EMAILS.includes(user.email.toLowerCase());
};

const issueEmailVerification = async (user) => {
  const token = createRandomToken();
  const tokenHash = hashToken(token);
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  const verifyLink = `${APP_URL}/verify-email?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: "Verify your CardSense account",
    text: `Verify your email: ${verifyLink}`,
    html: `<p>Verify your email: <a href="${verifyLink}">${verifyLink}</a></p>`,
  });
  return token;
};

const issuePasswordReset = async (user) => {
  const token = createRandomToken();
  const tokenHash = hashToken(token);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const resetLink = `${APP_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your CardSense password",
    text: `Reset your password: ${resetLink}`,
    html: `<p>Reset your password: <a href="${resetLink}">${resetLink}</a></p>`,
  });
  return token;
};

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail || typeof password !== "string" || password.length < 8) {
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: typeof name === "string" && name.trim() ? name.trim() : null,
      },
    });
    await ensureUserDefaultCategories(user.id);
    await ensureUserDefaultHeadAccounts(user.id);
    const token = await issueEmailVerification(user);
    res.status(201).json({
      success: true,
      user: sanitizeUser(user),
      verificationSent: true,
      verificationToken: process.env.NODE_ENV === "production" ? undefined : token,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Failed to sign up" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail || typeof password !== "string") {
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    if (!user.emailVerifiedAt) {
      res.status(403).json({ error: "Email not verified", verificationRequired: true });
      return;
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const token = createAccessToken(updated);
    res.json({ success: true, token, user: sanitizeUser(updated) });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.json({ success: true });
});

app.get("/api/auth/verify-email", async (req, res) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
      res.status(400).json({ error: "Missing token" });
      return;
    }
    const tokenHash = hashToken(token);
    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      res.status(400).json({ error: "Invalid or expired token" });
      return;
    }
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: now },
      }),
      prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      }),
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({ error: "Failed to verify email" });
  }
});

app.post("/api/auth/resend-verification", async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || user.emailVerifiedAt) {
      res.json({ success: true });
      return;
    }
    const token = await issueEmailVerification(user);
    res.json({
      success: true,
      verificationSent: true,
      verificationToken: process.env.NODE_ENV === "production" ? undefined : token,
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ error: "Failed to resend verification" });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (user) {
      const token = await issuePasswordReset(user);
      res.json({
        success: true,
        resetToken: process.env.NODE_ENV === "production" ? undefined : token,
      });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to send reset email" });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (typeof token !== "string" || typeof password !== "string" || password.length < 8) {
      res.status(400).json({ error: "Invalid token or password" });
      return;
    }
    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      res.status(400).json({ error: "Invalid or expired token" });
      return;
    }
    const passwordHash = await hashPassword(password);
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      }),
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.put("/api/auth/profile", requireAuth, async (req, res) => {
  try {
    const { name } = req.body || {};
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: typeof name === "string" && name.trim() ? name.trim() : null,
      },
    });
    res.json({ success: true, user: sanitizeUser(updated) });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/auth")) {
    next();
    return;
  }
  if (req.path.startsWith("/bank/callback")) {
    next();
    return;
  }
  if (req.path.startsWith("/feedback")) {
    next();
    return;
  }
  requireAuth(req, res, next);
});

app.get("/api/admin/metrics", async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [
      totalUsers,
      verifiedUsers,
      activeUsers,
      totalCards,
      totalBankAccounts,
      totalBankTransactions,
      totalTransactions,
      totalConnections,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
      prisma.user.count({ where: { lastLoginAt: { gte: since } } }),
      prisma.card.count(),
      prisma.bankAccount.count(),
      prisma.bankTransaction.count(),
      prisma.bankTransaction.count({
        where: { providerTransactionId: { startsWith: "manual-" } },
      }),
      prisma.bankConnection.count(),
    ]);

    res.json({
      success: true,
      metrics: {
        totalUsers,
        verifiedUsers,
        activeUsersLast30Days: activeUsers,
        totalCards,
        totalBankAccounts,
        totalBankTransactions,
        totalManualTransactions: totalTransactions,
        totalBankConnections: totalConnections,
      },
    });
  } catch (error) {
    console.error("Admin metrics error:", error);
    res.status(500).json({ error: "Failed to load metrics" });
  }
});

app.post("/api/feedback", async (req, res) => {
  try {
    const user = await getOptionalUser(req);
    const { name, email, message } = req.body || {};
    const resolvedName =
      typeof name === "string" && name.trim()
        ? name.trim()
        : user?.name || "Anonymous";
    const resolvedEmail =
      typeof email === "string" && email.trim()
        ? email.trim()
        : user?.email || "anonymous@local";
    const body = typeof message === "string" ? message.trim() : "";

    if (!body) {
      res.status(400).json({ error: "Message is required" });
      return;
    }
    if (!FEEDBACK_EMAIL) {
      res.status(500).json({ error: "Feedback email not configured" });
      return;
    }

    await sendEmail({
      to: FEEDBACK_EMAIL,
      subject: `CardSense Feedback from ${resolvedName}`,
      text: `Name: ${resolvedName}\nEmail: ${resolvedEmail}\n\n${body}`,
      html: `<p><strong>Name:</strong> ${resolvedName}</p><p><strong>Email:</strong> ${resolvedEmail}</p><p>${body}</p>`,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Feedback error:", error);
    res.status(500).json({ error: "Failed to send feedback" });
  }
});

app.get("/api/cards", async (req, res) => {
  try {
    const userId = req.user.id;
    const cards = await prisma.card.findMany({
      where: { userId },
      include: { cardType: true, bankRef: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(cards);
  } catch (error) {
    console.error("Failed to fetch cards:", error);
    res.status(500).json({ error: "Failed to fetch cards" });
  }
});

app.post("/api/cards", async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body || {};
    if (!payload.name || !payload.bank || !payload.last4) {
      res.status(400).json({ error: "name, bank, and last4 are required" });
      return;
    }
    const card = await prisma.card.create({
      data: {
        userId,
        name: payload.name,
        nameOnCard: payload.nameOnCard || null,
        bank: payload.bank,
        bankId: payload.bankId || null,
        cardTypeId: payload.cardTypeId || null,
        cardCategory: payload.cardCategory || null,
        last4: payload.last4,
        fullCardNumber: payload.fullCardNumber || null,
        expiryDate: payload.expiryDate || null,
        cvv: payload.cvv || null,
        statementPassword: payload.statementPassword || null,
        limit: Number(payload.limit || 0),
        balance: Number(payload.balance || 0),
        cutoffDate: Number(payload.cutoffDate || 1),
        dueDate: Number(payload.dueDate || 1),
        last3DueDates: payload.last3DueDates || null,
        color: payload.color || "bg-gray-800",
      },
    });
    res.status(201).json(card);
  } catch (error) {
    console.error("Failed to create card:", error);
    res.status(500).json({ error: "Failed to create card" });
  }
});

app.put("/api/cards/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const updated = await prisma.card.updateMany({
      where: { id: req.params.id, userId },
      data: req.body || {},
    });
    if (!updated.count) {
      res.status(404).json({ error: "Card not found" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to update card:", error);
    res.status(500).json({ error: "Failed to update card" });
  }
});

app.delete("/api/cards/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const deleted = await prisma.card.deleteMany({ where: { id: req.params.id, userId } });
    if (!deleted.count) {
      res.status(404).json({ error: "Card not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete card:", error);
    res.status(500).json({ error: "Failed to delete card" });
  }
});

app.get("/api/banks", async (_req, res) => {
  try {
    const banks = await prisma.bank.findMany({ orderBy: { name: "asc" } });
    res.json(banks);
  } catch (error) {
    console.error("Failed to fetch banks:", error);
    res.status(500).json({ error: "Failed to fetch banks" });
  }
});

app.post("/api/banks", async (req, res) => {
  try {
    const { name, icon, color } = req.body || {};
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const bank = await prisma.bank.create({ data: { name, icon: icon || null, color: color || null } });
    res.status(201).json({ success: true, data: bank });
  } catch (error) {
    console.error("Failed to create bank:", error);
    res.status(500).json({ error: "Failed to create bank" });
  }
});

app.put("/api/banks/:id", async (req, res) => {
  try {
    const { name, icon, color } = req.body || {};
    const bank = await prisma.bank.update({
      where: { id: req.params.id },
      data: { name, icon: icon || null, color: color || null },
    });
    res.json({ success: true, data: bank });
  } catch (error) {
    console.error("Failed to update bank:", error);
    res.status(500).json({ error: "Failed to update bank" });
  }
});

app.delete("/api/banks/:id", async (req, res) => {
  try {
    await prisma.bank.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete bank:", error);
    res.status(500).json({ error: "Failed to delete bank" });
  }
});

app.get("/api/secure-vault", async (req, res) => {
  try {
    const userId = req.user.id;
    const records = await prisma.secureVaultRecord.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(records);
  } catch (error) {
    console.error("Failed to fetch secure vault records:", error);
    res.status(500).json({ error: "Failed to fetch secure vault records" });
  }
});

app.post("/api/secure-vault", async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body || {};
    if (!payload.recordType || !payload.label || !payload.encryptedPayload) {
      res.status(400).json({ error: "recordType, label, and encryptedPayload are required" });
      return;
    }
    const record = await prisma.secureVaultRecord.create({
      data: {
        userId,
        recordType: payload.recordType,
        label: String(payload.label),
        bankName: typeof payload.bankName === "string" ? payload.bankName : null,
        accountNumber: typeof payload.accountNumber === "string" ? payload.accountNumber : null,
        sortCode: typeof payload.sortCode === "string" ? payload.sortCode : null,
        cardLast4: typeof payload.cardLast4 === "string" ? payload.cardLast4 : null,
        username: typeof payload.username === "string" ? payload.username : null,
        status: typeof payload.status === "string" ? payload.status : "active",
        encryptedPayload: String(payload.encryptedPayload),
      },
    });
    res.status(201).json(record);
  } catch (error) {
    console.error("Failed to create secure vault record:", error);
    res.status(500).json({ error: "Failed to create secure vault record" });
  }
});

app.get("/api/secure-vault/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const record = await prisma.secureVaultRecord.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!record) {
      res.status(404).json({ error: "Record not found" });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error("Failed to fetch secure vault record:", error);
    res.status(500).json({ error: "Failed to fetch secure vault record" });
  }
});

app.put("/api/secure-vault/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body || {};
    const existing = await prisma.secureVaultRecord.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Record not found" });
      return;
    }
    const updated = await prisma.secureVaultRecord.update({
      where: { id: existing.id },
      data: {
        recordType: payload.recordType || existing.recordType,
        label: typeof payload.label === "string" ? payload.label : existing.label,
        bankName: typeof payload.bankName === "string" ? payload.bankName : existing.bankName,
        accountNumber: typeof payload.accountNumber === "string" ? payload.accountNumber : existing.accountNumber,
        sortCode: typeof payload.sortCode === "string" ? payload.sortCode : existing.sortCode,
        cardLast4: typeof payload.cardLast4 === "string" ? payload.cardLast4 : existing.cardLast4,
        username: typeof payload.username === "string" ? payload.username : existing.username,
        status: typeof payload.status === "string" ? payload.status : existing.status,
        encryptedPayload: typeof payload.encryptedPayload === "string" ? payload.encryptedPayload : existing.encryptedPayload,
      },
    });
    res.json(updated);
  } catch (error) {
    console.error("Failed to update secure vault record:", error);
    res.status(500).json({ error: "Failed to update secure vault record" });
  }
});

app.delete("/api/secure-vault/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await prisma.secureVaultRecord.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Record not found" });
      return;
    }
    await prisma.secureVaultRecord.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete secure vault record:", error);
    res.status(500).json({ error: "Failed to delete secure vault record" });
  }
});

app.get("/api/user-accounts", async (req, res) => {
  try {
    const userId = req.user.id;
    const accounts = await prisma.userAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { secureRecord: true, linkedBankAccount: true },
    });
    res.json(accounts);
  } catch (error) {
    console.error("Failed to fetch user accounts:", error);
    res.status(500).json({ error: "Failed to fetch user accounts" });
  }
});

app.post("/api/user-accounts", async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body || {};
    if (!payload.label) {
      res.status(400).json({ error: "label is required" });
      return;
    }
    let linkedBankAccountId = null;
    if (typeof payload.linkedBankAccountId === "string") {
      const bankAccount = await prisma.bankAccount.findFirst({
        where: { id: payload.linkedBankAccountId, userId },
      });
      if (!bankAccount) {
        res.status(404).json({ error: "Bank account not found" });
        return;
      }
      linkedBankAccountId = bankAccount.id;
    }
    let secureRecordId = null;
    if (typeof payload.secureRecordId === "string") {
      const record = await prisma.secureVaultRecord.findFirst({
        where: { id: payload.secureRecordId, userId },
      });
      if (!record) {
        res.status(404).json({ error: "Secure record not found" });
        return;
      }
      secureRecordId = record.id;
    }
    const account = await prisma.userAccount.create({
      data: {
        userId,
        label: String(payload.label),
        bankName: typeof payload.bankName === "string" ? payload.bankName : null,
        accountType: typeof payload.accountType === "string" ? payload.accountType : "bank",
        accountNumber: typeof payload.accountNumber === "string" ? payload.accountNumber : null,
        sortCode: typeof payload.sortCode === "string" ? payload.sortCode : null,
        currency: typeof payload.currency === "string" ? payload.currency : null,
        balance: typeof payload.balance === "number" ? payload.balance : payload.balance ? Number(payload.balance) : null,
        limit: typeof payload.limit === "number" ? payload.limit : payload.limit ? Number(payload.limit) : null,
        status: typeof payload.status === "string" ? payload.status : "active",
        linkedBankAccountId,
        secureRecordId,
      },
    });
    res.status(201).json(account);
  } catch (error) {
    console.error("Failed to create user account:", error);
    res.status(500).json({ error: "Failed to create user account" });
  }
});

app.get("/api/user-accounts/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const account = await prisma.userAccount.findFirst({
      where: { id: req.params.id, userId },
      include: { secureRecord: true, linkedBankAccount: true, cards: true },
    });
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.json(account);
  } catch (error) {
    console.error("Failed to fetch user account:", error);
    res.status(500).json({ error: "Failed to fetch user account" });
  }
});

app.put("/api/user-accounts/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body || {};
    const existing = await prisma.userAccount.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    let linkedBankAccountId = existing.linkedBankAccountId || null;
    if (payload.linkedBankAccountId === null) {
      linkedBankAccountId = null;
    } else if (typeof payload.linkedBankAccountId === "string") {
      const bankAccount = await prisma.bankAccount.findFirst({
        where: { id: payload.linkedBankAccountId, userId },
      });
      if (!bankAccount) {
        res.status(404).json({ error: "Bank account not found" });
        return;
      }
      linkedBankAccountId = bankAccount.id;
    }
    let secureRecordId = existing.secureRecordId || null;
    if (payload.secureRecordId === null) {
      secureRecordId = null;
    } else if (typeof payload.secureRecordId === "string") {
      const record = await prisma.secureVaultRecord.findFirst({
        where: { id: payload.secureRecordId, userId },
      });
      if (!record) {
        res.status(404).json({ error: "Secure record not found" });
        return;
      }
      secureRecordId = record.id;
    }
    const updated = await prisma.userAccount.update({
      where: { id: existing.id },
      data: {
        label: typeof payload.label === "string" ? payload.label : existing.label,
        bankName: typeof payload.bankName === "string" ? payload.bankName : existing.bankName,
        accountType: typeof payload.accountType === "string" ? payload.accountType : existing.accountType,
        accountNumber: typeof payload.accountNumber === "string" ? payload.accountNumber : existing.accountNumber,
        sortCode: typeof payload.sortCode === "string" ? payload.sortCode : existing.sortCode,
        currency: typeof payload.currency === "string" ? payload.currency : existing.currency,
        balance: payload.balance !== undefined ? Number(payload.balance) : existing.balance,
        limit: payload.limit !== undefined ? Number(payload.limit) : existing.limit,
        status: typeof payload.status === "string" ? payload.status : existing.status,
        linkedBankAccountId,
        secureRecordId,
      },
    });
    res.json(updated);
  } catch (error) {
    console.error("Failed to update user account:", error);
    res.status(500).json({ error: "Failed to update user account" });
  }
});

app.delete("/api/user-accounts/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await prisma.userAccount.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    await prisma.userAccount.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete user account:", error);
    res.status(500).json({ error: "Failed to delete user account" });
  }
});

app.get("/api/user-cards", async (req, res) => {
  try {
    const userId = req.user.id;
    const cards = await prisma.userCard.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { secureRecord: true, linkedBankAccount: true },
    });
    res.json(cards);
  } catch (error) {
    console.error("Failed to fetch user cards:", error);
    res.status(500).json({ error: "Failed to fetch user cards" });
  }
});

app.post("/api/user-cards", async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body || {};
    if (!payload.label) {
      res.status(400).json({ error: "label is required" });
      return;
    }
    let linkedBankAccountId = null;
    if (typeof payload.linkedBankAccountId === "string") {
      const bankAccount = await prisma.bankAccount.findFirst({
        where: { id: payload.linkedBankAccountId, userId },
      });
      if (!bankAccount) {
        res.status(404).json({ error: "Bank account not found" });
        return;
      }
      linkedBankAccountId = bankAccount.id;
    }
    let secureRecordId = null;
    if (typeof payload.secureRecordId === "string") {
      const record = await prisma.secureVaultRecord.findFirst({
        where: { id: payload.secureRecordId, userId },
      });
      if (!record) {
        res.status(404).json({ error: "Secure record not found" });
        return;
      }
      secureRecordId = record.id;
    }
    const card = await prisma.userCard.create({
      data: {
        userId,
        cardType: typeof payload.cardType === "string" ? payload.cardType : "credit",
        label: String(payload.label),
        issuerBankName: typeof payload.issuerBankName === "string" ? payload.issuerBankName : null,
        network: typeof payload.network === "string" ? payload.network : null,
        last4: typeof payload.last4 === "string" ? payload.last4 : null,
        statementDay: typeof payload.statementDay === "number" ? payload.statementDay : payload.statementDay ? Number(payload.statementDay) : null,
        dueDay: typeof payload.dueDay === "number" ? payload.dueDay : payload.dueDay ? Number(payload.dueDay) : null,
        last3StatementDates: typeof payload.last3StatementDates === "string" ? payload.last3StatementDates : null,
        last3DueDates: typeof payload.last3DueDates === "string" ? payload.last3DueDates : null,
        status: typeof payload.status === "string" ? payload.status : "active",
        imageUrl: typeof payload.imageUrl === "string" ? payload.imageUrl : null,
        linkedBankAccountId,
        secureRecordId,
      },
    });
    res.status(201).json(card);
  } catch (error) {
    console.error("Failed to create user card:", error);
    res.status(500).json({ error: "Failed to create user card" });
  }
});

app.get("/api/user-cards/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const card = await prisma.userCard.findFirst({
      where: { id: req.params.id, userId },
      include: { secureRecord: true, linkedBankAccount: true, accounts: true },
    });
    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }
    res.json(card);
  } catch (error) {
    console.error("Failed to fetch user card:", error);
    res.status(500).json({ error: "Failed to fetch user card" });
  }
});

app.put("/api/user-cards/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body || {};
    const existing = await prisma.userCard.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Card not found" });
      return;
    }
    let linkedBankAccountId = existing.linkedBankAccountId || null;
    if (payload.linkedBankAccountId === null) {
      linkedBankAccountId = null;
    } else if (typeof payload.linkedBankAccountId === "string") {
      const bankAccount = await prisma.bankAccount.findFirst({
        where: { id: payload.linkedBankAccountId, userId },
      });
      if (!bankAccount) {
        res.status(404).json({ error: "Bank account not found" });
        return;
      }
      linkedBankAccountId = bankAccount.id;
    }
    let secureRecordId = existing.secureRecordId || null;
    if (payload.secureRecordId === null) {
      secureRecordId = null;
    } else if (typeof payload.secureRecordId === "string") {
      const record = await prisma.secureVaultRecord.findFirst({
        where: { id: payload.secureRecordId, userId },
      });
      if (!record) {
        res.status(404).json({ error: "Secure record not found" });
        return;
      }
      secureRecordId = record.id;
    }
    const updated = await prisma.userCard.update({
      where: { id: existing.id },
      data: {
        cardType: typeof payload.cardType === "string" ? payload.cardType : existing.cardType,
        label: typeof payload.label === "string" ? payload.label : existing.label,
        issuerBankName: typeof payload.issuerBankName === "string" ? payload.issuerBankName : existing.issuerBankName,
        network: typeof payload.network === "string" ? payload.network : existing.network,
        last4: typeof payload.last4 === "string" ? payload.last4 : existing.last4,
        statementDay: payload.statementDay !== undefined ? Number(payload.statementDay) : existing.statementDay,
        dueDay: payload.dueDay !== undefined ? Number(payload.dueDay) : existing.dueDay,
        last3StatementDates: typeof payload.last3StatementDates === "string" ? payload.last3StatementDates : existing.last3StatementDates,
        last3DueDates: typeof payload.last3DueDates === "string" ? payload.last3DueDates : existing.last3DueDates,
        status: typeof payload.status === "string" ? payload.status : existing.status,
        imageUrl: typeof payload.imageUrl === "string" ? payload.imageUrl : existing.imageUrl,
        linkedBankAccountId,
        secureRecordId,
      },
    });
    res.json(updated);
  } catch (error) {
    console.error("Failed to update user card:", error);
    res.status(500).json({ error: "Failed to update user card" });
  }
});

app.delete("/api/user-cards/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await prisma.userCard.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Card not found" });
      return;
    }
    await prisma.userCard.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete user card:", error);
    res.status(500).json({ error: "Failed to delete user card" });
  }
});

app.get("/api/user-account-cards", async (req, res) => {
  try {
    const userId = req.user.id;
    const links = await prisma.userAccountCard.findMany({
      where: { userAccount: { userId } },
      include: { userAccount: true, userCard: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(links);
  } catch (error) {
    console.error("Failed to fetch user account cards:", error);
    res.status(500).json({ error: "Failed to fetch user account cards" });
  }
});

app.post("/api/user-account-cards", async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body || {};
    if (!payload.userAccountId || !payload.userCardId) {
      res.status(400).json({ error: "userAccountId and userCardId are required" });
      return;
    }
    const account = await prisma.userAccount.findFirst({
      where: { id: payload.userAccountId, userId },
    });
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    const card = await prisma.userCard.findFirst({
      where: { id: payload.userCardId, userId },
    });
    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }
    const link = await prisma.userAccountCard.create({
      data: {
        userAccountId: account.id,
        userCardId: card.id,
        relationType: typeof payload.relationType === "string" ? payload.relationType : null,
      },
    });
    res.status(201).json(link);
  } catch (error) {
    console.error("Failed to create user account card link:", error);
    res.status(500).json({ error: "Failed to create user account card link" });
  }
});

app.delete("/api/user-account-cards/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await prisma.userAccountCard.findFirst({
      where: { id: req.params.id, userAccount: { userId } },
    });
    if (!existing) {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    await prisma.userAccountCard.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete user account card link:", error);
    res.status(500).json({ error: "Failed to delete user account card link" });
  }
});

app.get("/api/card-types", async (_req, res) => {
  try {
    const cardTypes = await prisma.cardType.findMany({ orderBy: { name: "asc" } });
    res.json(cardTypes);
  } catch (error) {
    console.error("Failed to fetch card types:", error);
    res.status(500).json({ error: "Failed to fetch card types" });
  }
});

app.post("/api/card-types", async (req, res) => {
  try {
    const { name, icon, color } = req.body || {};
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const cardType = await prisma.cardType.create({ data: { name, icon: icon || null, color: color || null } });
    res.status(201).json({ success: true, data: cardType });
  } catch (error) {
    console.error("Failed to create card type:", error);
    res.status(500).json({ error: "Failed to create card type" });
  }
});

app.put("/api/card-types/:id", async (req, res) => {
  try {
    const { name, icon, color } = req.body || {};
    const cardType = await prisma.cardType.update({
      where: { id: req.params.id },
      data: { name, icon: icon || null, color: color || null },
    });
    res.json({ success: true, data: cardType });
  } catch (error) {
    console.error("Failed to update card type:", error);
    res.status(500).json({ error: "Failed to update card type" });
  }
});

app.delete("/api/card-types/:id", async (req, res) => {
  try {
    await prisma.cardType.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete card type:", error);
    res.status(500).json({ error: "Failed to delete card type" });
  }
});

app.get("/api/categories", async (req, res) => {
  try {
    const userId = req.user.id;
    const existingUserCategories = await prisma.category.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!existingUserCategories) {
      await ensureUserDefaultCategories(userId);
    }
    const categories = await prisma.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      include: {
        subCategories: { orderBy: { name: "asc" } },
      },
    });
    res.json(categories);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

app.get("/api/head-accounts", async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await prisma.headAccount.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!existing) {
      await ensureUserDefaultHeadAccounts(userId);
    }
    const headAccounts = await prisma.headAccount.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
    res.json(headAccounts);
  } catch (error) {
    console.error("Failed to fetch head accounts:", error);
    res.status(500).json({ error: "Failed to fetch head accounts" });
  }
});

app.post("/api/head-accounts", async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body || {};
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const headAccount = await prisma.headAccount.create({
      data: { userId, name: String(name).trim() },
    });
    res.status(201).json({ success: true, data: headAccount });
  } catch (error) {
    console.error("Failed to create head account:", error);
    res.status(500).json({ error: "Failed to create head account" });
  }
});

app.put("/api/head-accounts/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body || {};
    const updated = await prisma.headAccount.updateMany({
      where: { id: req.params.id, userId },
      data: { name: String(name || "").trim() },
    });
    if (!updated.count) {
      res.status(404).json({ error: "Head account not found" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to update head account:", error);
    res.status(500).json({ error: "Failed to update head account" });
  }
});

app.delete("/api/head-accounts/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const deleted = await prisma.headAccount.deleteMany({
      where: { id: req.params.id, userId },
    });
    if (!deleted.count) {
      res.status(404).json({ error: "Head account not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete head account:", error);
    res.status(500).json({ error: "Failed to delete head account" });
  }
});

app.post("/api/categories", async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, icon, color } = req.body || {};
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const category = await prisma.category.create({
      data: { userId, name, icon: icon || null, color: color || null },
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    console.error("Failed to create category:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

app.put("/api/categories/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, icon, color } = req.body || {};
    const updated = await prisma.category.updateMany({
      where: { id: req.params.id, userId },
      data: { name, icon: icon || null, color: color || null },
    });
    if (!updated.count) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to update category:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const deleted = await prisma.category.deleteMany({ where: { id: req.params.id, userId } });
    if (!deleted.count) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete category:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

app.post("/api/categories/:id/subcategories", async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body || {};
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    const subCategory = await prisma.subCategory.create({
      data: { name, categoryId: req.params.id },
    });
    res.status(201).json({ success: true, data: subCategory });
  } catch (error) {
    console.error("Failed to create sub-category:", error);
    res.status(500).json({ error: "Failed to create sub-category" });
  }
});

app.put("/api/subcategories/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body || {};
    const updated = await prisma.subCategory.updateMany({
      where: { id: req.params.id, category: { userId } },
      data: { name },
    });
    if (!updated.count) {
      res.status(404).json({ error: "Sub-category not found" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to update sub-category:", error);
    res.status(500).json({ error: "Failed to update sub-category" });
  }
});

app.delete("/api/subcategories/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const deleted = await prisma.subCategory.deleteMany({
      where: { id: req.params.id, category: { userId } },
    });
    if (!deleted.count) {
      res.status(404).json({ error: "Sub-category not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete sub-category:", error);
    res.status(500).json({ error: "Failed to delete sub-category" });
  }
});

app.get("/api/bank/connections", async (req, res) => {
  try {
    const userId = req.user.id;
    const connections = await prisma.bankConnection.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(connections);
  } catch (error) {
    console.error("Failed to fetch bank connections:", error);
    res.status(500).json({ error: "Failed to fetch bank connections" });
  }
});

app.delete("/api/bank/connections/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const deleted = await prisma.bankConnection.deleteMany({ where: { id: req.params.id, userId } });
    if (!deleted.count) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete bank connection:", error);
    res.status(500).json({ error: "Failed to delete bank connection" });
  }
});

app.delete("/api/bank/accounts/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const updated = await prisma.bankAccount.updateMany({
      where: { id: req.params.id, userId },
      data: { status: "deleted" },
    });
    if (!updated.count) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete bank account:", error);
    res.status(500).json({ error: "Failed to delete bank account" });
  }
});

app.get("/api/bank/accounts", async (req, res) => {
  try {
    const userId = req.user.id;
    const accounts = await prisma.bankAccount.findMany({
      where: { status: "active", userId },
      orderBy: { name: "asc" },
      include: { connection: true },
    });
    const cardAccounts = accounts.filter((acct) =>
      (acct.type || "").toLowerCase().includes("card")
    );
    const minStatementDate = cardAccounts
      .map((acct) => acct.statementDate)
      .filter(Boolean)
      .reduce((min, value) => (min && value && min < value ? min : value), null);

    let transactions = [];
    if (cardAccounts.length && minStatementDate) {
      transactions = await prisma.bankTransaction.findMany({
        where: {
          userId,
          accountId: { in: cardAccounts.map((acct) => acct.id) },
          date: { gte: minStatementDate },
        },
      });
    }
    const byAccount = transactions.reduce((acc, tx) => {
      const list = acc[tx.accountId] || [];
      list.push(tx);
      acc[tx.accountId] = list;
      return acc;
    }, {});

    const now = new Date();
    const enriched = accounts.map((acct) => {
      if (!(acct.type || "").toLowerCase().includes("card") || !acct.statementBalance || !acct.statementDate) {
        const derived = (!acct.accountNumber || !acct.sortCode) && acct.mask ? deriveUkAccountDetails(acct.mask) : null;
        return {
          ...acct,
          accountNumber: acct.accountNumber || derived?.accountNumber || null,
          sortCode: acct.sortCode || derived?.sortCode || null,
        };
      }
      const accountTx = byAccount[acct.id] || [];
      const dueDate = acct.statementDueDate || now;
      const paidAuto = accountTx
        .filter((tx) => tx.amount > 0 && tx.date >= acct.statementDate && tx.date <= dueDate)
        .reduce((sum, tx) => sum + tx.amount, 0);
      const paidManual = typeof acct.statementPaidAmount === "number" ? acct.statementPaidAmount : 0;
      const paidTotal = paidAuto + paidManual;
      const payable = Math.max(0, acct.statementBalance - paidTotal);
      const dueInDays = acct.statementDueDate
        ? Math.ceil((acct.statementDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const derived = (!acct.accountNumber || !acct.sortCode) && acct.mask ? deriveUkAccountDetails(acct.mask) : null;
      return {
        ...acct,
        accountNumber: acct.accountNumber || derived?.accountNumber || null,
        sortCode: acct.sortCode || derived?.sortCode || null,
        statementPaidComputed: paidTotal,
        statementPayable: payable,
        statementDueInDays: dueInDays,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error("Failed to fetch bank accounts:", error);
    res.status(500).json({ error: "Failed to fetch bank accounts" });
  }
});

app.post("/api/bank/accounts", async (req, res) => {
  try {
    const {
      name,
      type,
      bankName,
      mask,
      currency,
      balance,
      availableBalance,
      limit,
      accountNumber,
      sortCode,
      statementBalance,
      statementDate,
      statementDueDate,
      statementPaidAmount,
    } = req.body || {};
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const ownerId = req.user.id;
    let connection = await prisma.bankConnection.findFirst({
      where: { userId: ownerId, provider: "manual" },
    });
    if (!connection) {
      connection = await prisma.bankConnection.create({
        data: {
          userId: ownerId,
          provider: "manual",
          providerAccountId: `manual-${crypto.randomUUID()}`,
          accessToken: "manual",
          refreshToken: null,
          institutionId: bankName || null,
          status: "active",
        },
      });
    }
    const account = await prisma.bankAccount.create({
      data: {
        userId: ownerId,
        connectionId: connection.id,
        providerAccountId: `manual-${crypto.randomUUID()}`,
        type: type || "account",
        name,
        currency: currency || null,
        mask: mask || null,
        accountNumber: typeof accountNumber === "string" ? accountNumber : null,
        sortCode: typeof sortCode === "string" ? sortCode : null,
        statementBalance: typeof statementBalance === "number" ? statementBalance : null,
        statementDate: statementDate ? new Date(String(statementDate)) : null,
        statementDueDate: statementDueDate ? new Date(String(statementDueDate)) : null,
        statementPaidAmount: typeof statementPaidAmount === "number" ? statementPaidAmount : null,
        status: "active",
        tags: bankName ? `bank:${bankName}` : null,
        balance: Number.isFinite(Number(balance)) ? Number(balance) : 0,
        availableBalance: Number.isFinite(Number(availableBalance)) ? Number(availableBalance) : null,
        limit: Number.isFinite(Number(limit)) ? Number(limit) : null,
      },
    });
    res.status(201).json({ success: true, data: account });
  } catch (error) {
    console.error("Failed to create bank account:", error);
    res.status(500).json({ error: "Failed to create bank account" });
  }
});

app.put("/api/bank/accounts/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body || {};
    const data = {};
    if (typeof body.name === "string") data.name = body.name;
    if (typeof body.type === "string") data.type = body.type;
    if (typeof body.currency === "string") data.currency = body.currency;
    if (typeof body.mask === "string") data.mask = body.mask;
    if (typeof body.tags === "string") data.tags = body.tags;
    if (typeof body.accountNumber === "string") data.accountNumber = body.accountNumber;
    if (typeof body.sortCode === "string") data.sortCode = body.sortCode;
    if (typeof body.statementBalance === "number") data.statementBalance = body.statementBalance;
    if (body.statementDate) data.statementDate = new Date(String(body.statementDate));
    if (body.statementDueDate) data.statementDueDate = new Date(String(body.statementDueDate));
    if (typeof body.statementPaidAmount === "number") data.statementPaidAmount = body.statementPaidAmount;
    const balance = parseAmount(body.balance);
    const availableBalance = parseAmount(body.availableBalance);
    const limit = parseAmount(body.limit);
    if (balance !== null) data.balance = balance;
    if (availableBalance !== null) data.availableBalance = availableBalance;
    if (limit !== null) data.limit = limit;
    if (!Object.keys(data).length) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const updated = await prisma.bankAccount.updateMany({
      where: { id: req.params.id, userId },
      data,
    });
    if (!updated.count) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to update bank account:", error);
    res.status(500).json({ error: "Failed to update bank account" });
  }
});

app.get("/api/credentials/accounts", async (req, res) => {
  try {
    const userId = req.user.id;
    const bankAccountId = req.query.bankAccountId ? String(req.query.bankAccountId) : undefined;
    const includePayload = String(req.query.includePayload || "") === "true";
    const credentials = await prisma.bankAccountCredential.findMany({
      where: {
        userId,
        ...(bankAccountId ? { bankAccountId } : {}),
      },
      select: {
        id: true,
        bankAccountId: true,
        label: true,
        encryptedPayload: includePayload,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(credentials);
  } catch (error) {
    console.error("Failed to fetch account credentials:", error);
    res.status(500).json({ error: "Failed to fetch account credentials" });
  }
});

app.post("/api/credentials/accounts", async (req, res) => {
  try {
    const userId = req.user.id;
    const { bankAccountId, label, encryptedPayload } = req.body || {};
    if (!bankAccountId || !encryptedPayload) {
      res.status(400).json({ error: "bankAccountId and encryptedPayload are required" });
      return;
    }
    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId },
    });
    if (!account) {
      res.status(404).json({ error: "Bank account not found" });
      return;
    }
    const record = await prisma.bankAccountCredential.upsert({
      where: { bankAccountId },
      update: { label: label || null, encryptedPayload, userId },
      create: { bankAccountId, label: label || null, encryptedPayload, userId },
    });
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error("Failed to store account credentials:", error);
    res.status(500).json({ error: "Failed to store account credentials" });
  }
});

app.get("/api/credentials/cards", async (req, res) => {
  try {
    const userId = req.user.id;
    const cardId = req.query.cardId ? String(req.query.cardId) : undefined;
    const includePayload = String(req.query.includePayload || "") === "true";
    const credentials = await prisma.cardCredential.findMany({
      where: {
        userId,
        ...(cardId ? { cardId } : {}),
      },
      select: {
        id: true,
        cardId: true,
        label: true,
        encryptedPayload: includePayload,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(credentials);
  } catch (error) {
    console.error("Failed to fetch card credentials:", error);
    res.status(500).json({ error: "Failed to fetch card credentials" });
  }
});

app.post("/api/credentials/cards", async (req, res) => {
  try {
    const userId = req.user.id;
    const { cardId, label, encryptedPayload } = req.body || {};
    if (!cardId || !encryptedPayload) {
      res.status(400).json({ error: "cardId and encryptedPayload are required" });
      return;
    }
    const card = await prisma.card.findFirst({ where: { id: cardId, userId } });
    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }
    const record = await prisma.cardCredential.upsert({
      where: { cardId },
      update: { label: label || null, encryptedPayload, userId },
      create: { cardId, label: label || null, encryptedPayload, userId },
    });
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error("Failed to store card credentials:", error);
    res.status(500).json({ error: "Failed to store card credentials" });
  }
});

app.post("/api/bank/exchange", async (req, res) => {
  try {
    const { code, redirectUri } = req.body || {};
    const userId = req.user.id;
    if (!code) {
      res.status(400).json({ success: false, error: "code is required" });
      return;
    }

    const redirect = redirectUri || process.env.TRUELAYER_REDIRECT_URI || "http://localhost:8081/api/bank/callback";
    const tokenData = await exchangeCodeForTokens(code, redirect);
    const info = await fetchInfo(tokenData.access_token).catch(() => null);

    const connection = await prisma.bankConnection.create({
      data: {
        userId,
        provider: "truelayer",
        providerAccountId: info?.user_id || crypto.randomUUID(),
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        institutionId: info?.provider_id || null,
        status: "active",
      },
    });

    res.json({ success: true, connection });
  } catch (error) {
    console.error("Bank exchange error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to exchange token" });
  }
});

app.get("/api/bank/callback", async (req, res) => {
  try {
    const code = req.query.code ? String(req.query.code) : null;
    const state = req.query.state ? String(req.query.state) : "";
    let userId = null;
    if (state) {
      try {
        const payload = verifyAccessToken(state);
        userId = payload.sub;
      } catch {
        userId = null;
      }
    }
    if (!userId && req.query.userId && process.env.NODE_ENV !== "production") {
      userId = String(req.query.userId);
    }
    if (!userId) {
      res.status(400).json({ success: false, error: "Missing user state" });
      return;
    }
    const redirectUri = process.env.TRUELAYER_REDIRECT_URI || "http://localhost:8081/api/bank/callback";

    if (!code) {
      res.status(400).json({ success: false, error: "Missing code" });
      return;
    }

    const tokenData = await exchangeCodeForTokens(code, redirectUri);
    const info = await fetchInfo(tokenData.access_token).catch(() => null);
    const providerAccountId = info?.user_id || crypto.randomUUID();

    const connection = await prisma.bankConnection.create({
      data: {
        userId,
        provider: "truelayer",
        providerAccountId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        institutionId: info?.provider_id || null,
        status: "active",
      },
    });

    const accounts = await fetchAccounts(tokenData.access_token).catch(() => []);
    const cards = await fetchCards(tokenData.access_token).catch(() => []);

    for (const acct of accounts) {
      const balancePayload = await fetchAccountBalance(tokenData.access_token, acct.account_id).catch(() => null);
      const balancePatch = normalizeBalancePayload(balancePayload);
      const rawIban = acct.account_number?.iban || acct.account_number?.number || "";
      const derived = deriveUkAccountDetails(rawIban);
      const accountNumber = acct.account_number?.number || derived.accountNumber || null;
      const sortCode = acct.account_number?.sort_code || derived.sortCode || null;
      const inferredType = inferAccountType(acct);
      await prisma.bankAccount.upsert({
        where: { userId_providerAccountId: { userId, providerAccountId: acct.account_id } },
        update: {
          userId,
          connectionId: connection.id,
          type: inferredType,
          name: acct.display_name || acct.account_id || null,
          currency: acct.currency || null,
          mask: acct.account_number?.iban || acct.account_number?.number?.slice(-4) || null,
          accountNumber,
          sortCode,
          status: "active",
          ...balancePatch,
        },
        create: {
          userId,
          connectionId: connection.id,
          providerAccountId: acct.account_id,
          type: inferredType,
          name: acct.display_name || acct.account_id || null,
          currency: acct.currency || null,
          mask: acct.account_number?.iban || acct.account_number?.number?.slice(-4) || null,
          accountNumber,
          sortCode,
          status: "active",
          balance: balancePatch.balance ?? 0,
          availableBalance: balancePatch.availableBalance ?? null,
          limit: balancePatch.limit ?? null,
        },
      });
    }

    for (const card of cards) {
      const providerId = card.card_id || card.account_id || card.resource_id || card.display_name || card.name_on_card;
      if (!providerId) continue;
      const cardBalancePayload = await fetchCardBalance(tokenData.access_token, providerId).catch(() => null);
      const cardBalancePatch = normalizeBalancePayload(cardBalancePayload);
      await prisma.bankAccount.upsert({
        where: { userId_providerAccountId: { userId, providerAccountId: providerId } },
        update: {
          userId,
          connectionId: connection.id,
          type: "card",
          name: card.display_name || card.name_on_card || card.card_network || card.card_type || null,
          currency: card.currency || null,
          mask: card.partial_card_number || card.card_number?.slice(-4) || null,
          status: "active",
          ...cardBalancePatch,
        },
        create: {
          userId,
          connectionId: connection.id,
          providerAccountId: providerId,
          type: "card",
          name: card.display_name || card.name_on_card || card.card_network || card.card_type || null,
          currency: card.currency || null,
          mask: card.partial_card_number || card.card_number?.slice(-4) || null,
          status: "active",
          balance: cardBalancePatch.balance ?? 0,
          availableBalance: cardBalancePatch.availableBalance ?? null,
          limit: cardBalancePatch.limit ?? null,
        },
      });
    }

    for (const acct of accounts) {
      const txns = await fetchTransactions(tokenData.access_token, acct.account_id).catch(() => []);
      const accountId = await ensureAccountId(userId, connection.id, acct.account_id, "account");
      for (const tx of txns) {
        const providerTransactionId = tx.transaction_id || tx.id || tx.normalised_provider_transaction_id;
        if (!providerTransactionId) continue;
        const rawString = JSON.stringify(tx);
        const direction = tx.amount?.value && tx.amount.value < 0 ? "debit" : "credit";
        const { category: mappedCategory } = await resolveTransactionCategory(tx, userId);
        const runningBalance = parseAmount(tx.running_balance ?? tx.balance ?? null);
        await prisma.bankTransaction.upsert({
          where: { userId_providerTransactionId: { userId, providerTransactionId } },
          update: {
            userId,
            accountId,
            amount: tx.amount?.value ?? tx.amount ?? 0,
            currency: tx.amount?.currency ?? tx.currency ?? null,
            descriptionVia: tx.description || tx.merchant_name || null,
            merchant: tx.merchant_name || null,
            category: mappedCategory,
            direction,
            date: tx.timestamp ? new Date(tx.timestamp) : new Date(),
            pending: Boolean(tx.status && tx.status !== "posted"),
            runningBalance,
            raw: rawString,
          },
          create: {
            userId,
            accountId,
            providerTransactionId,
            amount: tx.amount?.value ?? tx.amount ?? 0,
            currency: tx.amount?.currency ?? tx.currency ?? null,
            descriptionVia: tx.description || tx.merchant_name || null,
            merchant: tx.merchant_name || null,
            category: mappedCategory,
            direction,
            date: tx.timestamp ? new Date(tx.timestamp) : new Date(),
            pending: Boolean(tx.status && tx.status !== "posted"),
            runningBalance,
            raw: rawString,
          },
        });
      }
    }

    for (const card of cards) {
      const providerId = card.card_id || card.account_id || card.resource_id || card.display_name || card.name_on_card;
      if (!providerId) continue;
      const txns = await fetchCardTransactions(tokenData.access_token, providerId).catch(() => []);
      const accountId = await ensureAccountId(userId, connection.id, providerId, "card");
      for (const tx of txns) {
        const providerTransactionId = tx.transaction_id || tx.id || tx.normalised_provider_transaction_id;
        if (!providerTransactionId) continue;
        const rawString = JSON.stringify(tx);
        const direction = tx.amount?.value && tx.amount.value < 0 ? "debit" : "credit";
        const { category: mappedCategory } = await resolveTransactionCategory(tx, userId);
        const runningBalance = parseAmount(tx.running_balance ?? tx.balance ?? null);
        await prisma.bankTransaction.upsert({
          where: { userId_providerTransactionId: { userId, providerTransactionId } },
          update: {
            userId,
            accountId,
            amount: tx.amount?.value ?? tx.amount ?? 0,
            currency: tx.amount?.currency ?? tx.currency ?? null,
            descriptionVia: tx.description || tx.merchant_name || null,
            merchant: tx.merchant_name || null,
            category: mappedCategory,
            direction,
            date: tx.timestamp ? new Date(tx.timestamp) : new Date(),
            pending: Boolean(tx.status && tx.status !== "posted"),
            runningBalance,
            raw: rawString,
          },
          create: {
            userId,
            accountId,
            providerTransactionId,
            amount: tx.amount?.value ?? tx.amount ?? 0,
            currency: tx.amount?.currency ?? tx.currency ?? null,
            descriptionVia: tx.description || tx.merchant_name || null,
            merchant: tx.merchant_name || null,
            category: mappedCategory,
            direction,
            date: tx.timestamp ? new Date(tx.timestamp) : new Date(),
            pending: Boolean(tx.status && tx.status !== "posted"),
            runningBalance,
            raw: rawString,
          },
        });
      }
    }

    const redirect = process.env.POST_CONNECT_REDIRECT || "http://localhost:3000/settings";
    res.redirect(redirect);
  } catch (error) {
    console.error("Bank callback error:", error);
    res.status(500).json({ success: false, error: error.message || "Callback failed" });
  }
});

app.post("/api/bank/sync", async (req, res) => {
  try {
    const { accountId, fromDate, toDate } = req.body || {};
    const userId = req.user.id;
    const range = normalizeDateRange(fromDate, toDate);
    const fromIso = range.from ? range.from.toISOString() : undefined;
    const toIso = range.to ? range.to.toISOString() : undefined;
    let connections;
    if (accountId) {
      const acct = await prisma.bankAccount.findFirst({
        where: { id: accountId, userId },
        include: { connection: true },
      });
      if (!acct || !acct.connection) {
        res.status(400).json({ success: false, error: "Account not found or missing connection" });
        return;
      }
      connections = [acct.connection];
    } else {
      connections = await prisma.bankConnection.findMany({
        where: { userId },
      });
    }

    let synced = 0;
    for (const connection of connections) {
      try {
        const accounts = await fetchAccounts(connection.accessToken).catch(() => []);
        const cards = await fetchCards(connection.accessToken).catch(() => []);
        const allAccounts = [
          ...accounts
            .map((acct) => ({
              id: acct.account_id,
              type: inferAccountType(acct),
              name: acct.display_name || acct.account_id,
              currency: acct.currency,
              mask: acct.account_number?.iban || acct.account_number?.number?.slice(-4),
              accountNumber: acct.account_number?.number || deriveUkAccountDetails(acct.account_number?.iban || acct.account_number?.number || "").accountNumber || null,
              sortCode: acct.account_number?.sort_code || deriveUkAccountDetails(acct.account_number?.iban || acct.account_number?.number || "").sortCode || null,
            }))
            .filter((acct) => acct.id),
          ...cards
            .map((card) => ({
              id: card.card_id || card.account_id || card.resource_id || card.display_name || card.name_on_card,
              type: "card",
              name: card.display_name || card.name_on_card || card.card_network,
              currency: card.currency,
              mask: card.partial_card_number || card.card_number?.slice(-4),
            }))
            .filter((card) => card.id),
        ];

        for (const acct of allAccounts) {
          const balancePayload =
            acct.type === "card"
              ? await fetchCardBalance(connection.accessToken, acct.id).catch(() => null)
              : await fetchAccountBalance(connection.accessToken, acct.id).catch(() => null);
          const balancePatch = normalizeBalancePayload(balancePayload);
          const derived = deriveUkAccountDetails(acct.mask || "");
          const accountNumber = acct.accountNumber || derived.accountNumber || null;
          const sortCode = acct.sortCode || derived.sortCode || null;
          const account = await prisma.bankAccount.upsert({
            where: { userId_providerAccountId: { userId, providerAccountId: acct.id } },
            update: {
              userId,
              connectionId: connection.id,
              type: acct.type,
              name: acct.name,
              currency: acct.currency,
              mask: acct.mask,
              accountNumber,
              sortCode,
              status: "active",
              ...balancePatch,
            },
            create: {
              userId,
              connectionId: connection.id,
              providerAccountId: acct.id,
              type: acct.type,
              name: acct.name,
              currency: acct.currency,
              mask: acct.mask,
              accountNumber,
              sortCode,
              status: "active",
              balance: balancePatch.balance ?? 0,
              availableBalance: balancePatch.availableBalance ?? null,
              limit: balancePatch.limit ?? null,
            },
          });

          if (accountId && acct.id !== account.providerAccountId) continue;

          const txns =
            acct.type === "card"
              ? await fetchCardTransactions(connection.accessToken, acct.id, fromIso, toIso).catch(() => [])
              : await fetchTransactions(connection.accessToken, acct.id, fromIso, toIso).catch(() => []);
          for (const tx of txns) {
            const providerTransactionId = tx.transaction_id || tx.id || tx.normalised_provider_transaction_id;
            if (!providerTransactionId) continue;
            const rawString = JSON.stringify(tx);
            const direction = tx.amount?.value && tx.amount.value < 0 ? "debit" : "credit";
            const { category: mappedCategory } = await resolveTransactionCategory(tx, userId);
            const runningBalance = parseAmount(tx.running_balance ?? tx.balance ?? null);
            await prisma.bankTransaction.upsert({
              where: { userId_providerTransactionId: { userId, providerTransactionId } },
              update: {
                userId,
                accountId: account.id,
                amount: tx.amount?.value ?? tx.amount ?? 0,
                currency: tx.amount?.currency ?? tx.currency ?? null,
                descriptionVia: tx.description || tx.merchant_name || null,
                merchant: tx.merchant_name || null,
                category: mappedCategory,
                direction,
                date: tx.timestamp ? new Date(tx.timestamp) : new Date(),
                pending: Boolean(tx.status && tx.status !== "posted"),
                runningBalance,
                raw: rawString,
              },
              create: {
                userId,
                accountId: account.id,
                providerTransactionId,
                amount: tx.amount?.value ?? tx.amount ?? 0,
                currency: tx.amount?.currency ?? tx.currency ?? null,
                descriptionVia: tx.description || tx.merchant_name || null,
                merchant: tx.merchant_name || null,
                category: mappedCategory,
                direction,
                date: tx.timestamp ? new Date(tx.timestamp) : new Date(),
                pending: Boolean(tx.status && tx.status !== "posted"),
                runningBalance,
                raw: rawString,
              },
            });
          }

          const existingRows = await prisma.bankTransaction.findMany({
            where: {
              userId,
              accountId: account.id,
              ...(range.from || range.to
                ? {
                    date: {
                      ...(range.from ? { gte: range.from } : {}),
                      ...(range.to ? { lte: range.to } : {}),
                    },
                  }
                : {}),
            },
            select: { id: true, category: true, raw: true, merchant: true, descriptionVia: true },
          });
          for (const row of existingRows) {
            let parsed = {};
            if (row.raw) {
              try {
                parsed = JSON.parse(row.raw);
              } catch {
                parsed = {};
              }
            }
            if (!parsed.merchant_name && row.merchant) parsed.merchant_name = row.merchant;
            if (!parsed.description && row.descriptionVia) parsed.description = row.descriptionVia;
            const merchantKey = buildMerchantKey(parsed);
            const rule = merchantKey
              ? await prisma.merchantCategoryRule.findUnique({ where: { userId_merchantKey: { userId, merchantKey } } })
              : null;
            const mapped = rule?.category || mapOpenBankingCategory(parsed);
            if (mapped && mapped !== row.category) {
              await prisma.bankTransaction.update({
                where: { id: row.id },
                data: { category: mapped },
              });
            }
          }
        }
        synced += 1;
      } catch (err) {
        console.error("Sync error for connection", connection.id, err);
      }
    }
    res.json({ success: true, synced });
  } catch (error) {
    console.error("Bank sync error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to sync" });
  }
});

async function ensureAccountId(userId, connectionId, providerAccountId, type) {
  const existing = await prisma.bankAccount.findFirst({
    where: { userId, providerAccountId },
  });
  if (existing) {
    if (type && existing.type !== type) {
      await prisma.bankAccount.update({
        where: { id: existing.id },
        data: { type },
      });
    }
    return existing.id;
  }
  const created = await prisma.bankAccount.create({
    data: {
      userId,
      connectionId,
      providerAccountId,
      type: type || "account",
      status: "active",
    },
  });
  return created.id;
}

app.get("/api/transactions/drafts", async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Number(req.query.page || "1");
    const pageSize = Number(req.query.pageSize || "15");
    const search = req.query.search ? String(req.query.search) : undefined;
    const accountId = req.query.accountId ? String(req.query.accountId) : undefined;
    const category = req.query.categoryId ? String(req.query.categoryId) : undefined;
    const fromDate = req.query.fromDate ? String(req.query.fromDate) : undefined;
    const toDate = req.query.toDate ? String(req.query.toDate) : undefined;
    const range = normalizeDateRange(fromDate, toDate);

    const where = { userId };
    const orFilters = [];
    if (search) {
      orFilters.push(
        { merchant: { contains: search } },
        { descriptionVia: { contains: search } },
        { category: { contains: search } }
      );
    }
    if (accountId) where.accountId = accountId;
    if (category) where.category = category;
    if (range.from || range.to) {
      where.date = {
        ...(range.from ? { gte: range.from } : {}),
        ...(range.to ? { lte: range.to } : {}),
      };
    }
    if (orFilters.length) where.OR = orFilters;

    const [total, drafts] = await Promise.all([
      prisma.bankTransaction.count({ where }),
      prisma.bankTransaction.findMany({
        where,
        orderBy: { date: "desc" },
        skip: page > 0 ? (page - 1) * pageSize : 0,
        take: pageSize,
        include: { account: true, meta: true },
      }),
    ]);

    const parsedById = new Map();
    const merchantKeys = [];
    for (const draft of drafts) {
      let parsed = {};
      if (draft.raw) {
        try {
          parsed = JSON.parse(draft.raw);
        } catch {
          parsed = {};
        }
      }
      if (!parsed.description && draft.descriptionVia) parsed.description = draft.descriptionVia;
      if (!parsed.merchant_name && draft.merchant) parsed.merchant_name = draft.merchant;
      const merchantKey = buildMerchantKey(parsed);
      if (merchantKey) merchantKeys.push(merchantKey);
      parsedById.set(draft.id, { parsed, merchantKey });
    }
    const uniqueMerchantKeys = Array.from(new Set(merchantKeys));
    const rules = uniqueMerchantKeys.length
      ? await prisma.merchantCategoryRule.findMany({
          where: { userId, merchantKey: { in: uniqueMerchantKeys } },
        })
      : [];
    const ruleMap = new Map(rules.map((rule) => [rule.merchantKey, rule]));

    const draftsWithSource = drafts.map((draft) => {
      const info = parsedById.get(draft.id) || {};
      const merchantKey = info.merchantKey;
      const parsed = info.parsed || {};
      const rule = merchantKey ? ruleMap.get(merchantKey) : null;
      const source = rule?.source || resolveOpenBankingCategory(parsed).source || "fallback";
      return { ...draft, categorySource: source };
    });

    res.json({
      success: true,
      data: draftsWithSource,
      meta: { total, page, pageSize },
    });
  } catch (error) {
    console.error("transactions drafts GET error", error);
    res.status(500).json({ success: false, error: "Failed to load transactions" });
  }
});

app.post("/api/transactions/drafts", async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body || {};
    const amount = typeof body.amount === "number" ? body.amount : Number(body.amount || 0);
    const bookingDate = body.date ? new Date(String(body.date)) : new Date();
    const headAccount = typeof body.headAccount === "string" ? body.headAccount.trim() : "";
    if (!headAccount) {
      res.status(400).json({ success: false, error: "Head Account is required." });
      return;
    }
    await ensureHeadAccount(userId, headAccount);
    if (typeof body.category === "string") {
      await ensureUserCategory(userId, body.category);
    }
    const attachments =
      Array.isArray(body.attachments) ? body.attachments : typeof body.attachments === "string" ? body.attachments.split(",") : [];
    const cleanedAttachments = attachments
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    if (typeof body.accountId === "string") {
      const account = await prisma.bankAccount.findFirst({
        where: { id: body.accountId, userId },
      });
      if (!account) {
        res.status(404).json({ success: false, error: "Account not found" });
        return;
      }
    }
    const created = await prisma.bankTransaction.create({
      data: {
        id: `manual-${Date.now()}`,
        userId,
        accountId: typeof body.accountId === "string" ? body.accountId : "",
        providerTransactionId:
          typeof body.providerTransactionId === "string" ? body.providerTransactionId : `manual-${Date.now()}`,
        merchant: typeof body.merchantTo === "string" ? body.merchantTo : typeof body.merchantName === "string" ? body.merchantName : null,
        descriptionVia:
          typeof body.descriptionVia === "string"
            ? body.descriptionVia
            : typeof body.description === "string"
              ? body.description
              : typeof body.merchantName === "string"
                ? body.merchantName
                : null,
        category: typeof body.category === "string" ? body.category : null,
        currency: typeof body.currency === "string" ? body.currency : "USD",
        amount,
        direction: typeof body.direction === "string" ? body.direction : amount < 0 ? "debit" : "credit",
        date: bookingDate,
        pending: false,
        raw: typeof body.raw === "string" ? body.raw : null,
        meta: {
          create: {
            userId,
            openingBalance: typeof body.openingBalance === "number" ? body.openingBalance : body.openingBalance ? Number(body.openingBalance) : null,
            closingBalance: typeof body.closingBalance === "number" ? body.closingBalance : body.closingBalance ? Number(body.closingBalance) : null,
            fromEntity: typeof body.fromEntity === "string" ? body.fromEntity : null,
            viaEntity: typeof body.viaEntity === "string" ? body.viaEntity : null,
            toEntity: typeof body.toEntity === "string" ? body.toEntity : null,
            headAccount,
            subCategory: typeof body.subCategory === "string" ? body.subCategory : null,
            remarks: typeof body.remarks === "string" ? body.remarks : null,
            comments: typeof body.comments === "string" ? body.comments : null,
            attachmentsJson: cleanedAttachments.length ? JSON.stringify(cleanedAttachments) : null,
          },
        },
      },
    });
    res.json({ success: true, data: created });
  } catch (error) {
    console.error("transactions drafts POST error", error);
    res.status(500).json({ success: false, error: "Failed to create transaction" });
  }
});

app.post("/api/merchant-rules/from-transaction", async (req, res) => {
  try {
    const userId = req.user.id;
    const transactionId = typeof req.body?.transactionId === "string" ? req.body.transactionId : "";
    const source = typeof req.body?.source === "string" ? req.body.source : "internet";
    if (!transactionId) {
      res.status(400).json({ success: false, error: "transactionId is required" });
      return;
    }
    const tx = await prisma.bankTransaction.findFirst({
      where: { id: transactionId, userId },
    });
    if (!tx) {
      res.status(404).json({ success: false, error: "Transaction not found" });
      return;
    }
    let parsed = {};
    if (tx.raw) {
      try {
        parsed = JSON.parse(tx.raw);
      } catch {
        parsed = {};
      }
    }
    if (!parsed.description && tx.descriptionVia) parsed.description = tx.descriptionVia;
    if (!parsed.merchant_name && tx.merchant) parsed.merchant_name = tx.merchant;
    const merchantKey = buildMerchantKey(parsed);
    if (!merchantKey) {
      res.status(400).json({ success: false, error: "Merchant key unavailable" });
      return;
    }
    const category = tx.category || mapOpenBankingCategory(parsed);
    const rule = await prisma.merchantCategoryRule.upsert({
      where: { userId_merchantKey: { userId, merchantKey } },
      update: { category, source },
      create: { userId, merchantKey, category, source },
    });
    res.json({ success: true, rule });
  } catch (error) {
    console.error("merchant rule update error", error);
    res.status(500).json({ success: false, error: "Failed to update rule" });
  }
});

app.patch("/api/transactions/drafts/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body || {};
    const data = {};
    if (typeof body.merchantTo === "string") data.merchant = body.merchantTo;
    if (typeof body.merchant === "string") data.merchant = body.merchant;
    if (body.amount !== undefined && body.amount !== null && !Number.isNaN(Number(body.amount))) {
      data.amount = Number(body.amount);
    }
    if (typeof body.category === "string") {
      data.category = body.category;
      await ensureUserCategory(userId, body.category);
    }
    if (typeof body.descriptionVia === "string") data.descriptionVia = body.descriptionVia;
    if (typeof body.description === "string") data.descriptionVia = body.description;
    if (typeof body.direction === "string") data.direction = body.direction;
    if (body.date !== undefined) {
      const dateVal = typeof body.date === "string" ? new Date(body.date) : null;
      if (dateVal && Number.isNaN(dateVal.getTime())) {
        res.status(400).json({ success: false, error: "Invalid date" });
        return;
      }
      if (dateVal) data.date = dateVal;
    }
    const metaUpdate = {};
    if (body.openingBalance !== undefined) {
      const openingBalance = Number(body.openingBalance);
      if (!Number.isNaN(openingBalance)) metaUpdate.openingBalance = openingBalance;
    }
    if (body.closingBalance !== undefined) {
      const closingBalance = Number(body.closingBalance);
      if (!Number.isNaN(closingBalance)) metaUpdate.closingBalance = closingBalance;
    }
    if (typeof body.fromEntity === "string") metaUpdate.fromEntity = body.fromEntity;
    if (typeof body.viaEntity === "string") metaUpdate.viaEntity = body.viaEntity;
    if (typeof body.toEntity === "string") metaUpdate.toEntity = body.toEntity;
    if (typeof body.headAccount === "string") {
      const headAccount = body.headAccount.trim();
      if (!headAccount) {
        res.status(400).json({ success: false, error: "Head Account is required." });
        return;
      }
      await ensureHeadAccount(userId, headAccount);
      metaUpdate.headAccount = headAccount;
    }
    if (typeof body.subCategory === "string") metaUpdate.subCategory = body.subCategory;
    if (typeof body.remarks === "string") metaUpdate.remarks = body.remarks;
    if (typeof body.comments === "string") metaUpdate.comments = body.comments;
    if (body.attachments !== undefined) {
      const attachments =
        Array.isArray(body.attachments) ? body.attachments : typeof body.attachments === "string" ? body.attachments.split(",") : [];
      const cleanedAttachments = attachments
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
      metaUpdate.attachmentsJson = cleanedAttachments.length ? JSON.stringify(cleanedAttachments) : null;
    }
    if (!Object.keys(data).length && !Object.keys(metaUpdate).length) {
      res.status(400).json({ success: false, error: "No fields to update" });
      return;
    }
    const existing = await prisma.bankTransaction.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: "Transaction not found" });
      return;
    }
    const updated = await prisma.bankTransaction.update({
      where: { id: req.params.id },
      data: {
        ...data,
        meta: Object.keys(metaUpdate).length
          ? {
              upsert: {
                create: { ...metaUpdate, userId },
                update: metaUpdate,
              },
            }
          : undefined,
      },
      include: { account: true, meta: true },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("bank transaction PATCH error", error);
    res.status(500).json({ success: false, error: "Failed to update transaction" });
  }
});

app.delete("/api/transactions/drafts/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await prisma.bankTransaction.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Transaction not found" });
      return;
    }
    const isManual = typeof existing.providerTransactionId === "string" && existing.providerTransactionId.startsWith("manual-");
    if (!isManual) {
      res.status(403).json({ success: false, error: "Only cash transactions can be deleted." });
      return;
    }
    await prisma.bankTransaction.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error("bank transaction DELETE error", error);
    res.status(500).json({ success: false, error: "Failed to delete transaction" });
  }
});

app.post("/api/transactions/drafts/:id/approve", async (req, res) => {
  try {
    const userId = req.user.id;
    const bankTx = await prisma.bankTransaction.findFirst({
      where: { id: req.params.id, userId },
      include: { account: true },
    });
    if (!bankTx) {
      res.status(404).json({ success: false, error: "Transaction not found" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error("transactions approve error", error);
    res.status(500).json({ success: false, error: "Failed to approve transaction" });
  }
});

app.get("/api/transactions", async (req, res) => {
  try {
    const userId = req.user.id;
    const { cardId, category, transactionType, dateFrom, dateTo, limit } = req.query;
    const where = {
      userId,
      providerTransactionId: { startsWith: "manual-" },
    };
    if (category) where.category = String(category);
    if (dateFrom || dateTo) {
      const range = normalizeDateRange(
        dateFrom ? String(dateFrom) : undefined,
        dateTo ? String(dateTo) : undefined
      );
      where.date = {
        ...(range.from ? { gte: range.from } : {}),
        ...(range.to ? { lte: range.to } : {}),
      };
    }
    const takeCount = limit ? Number(limit) : 1000;
    const transactions = await prisma.bankTransaction.findMany({
      where,
      include: { meta: true },
      orderBy: { date: "desc" },
      take: takeCount,
    });
    const mapped = transactions.map((tx) => {
      const manualMeta = getManualRawMeta(tx.raw);
      return {
        id: tx.id,
        userId: tx.userId,
        cardId: manualMeta?.cardId || null,
        providerTxId: tx.providerTransactionId || null,
        merchant: tx.merchant || "",
        amount: Math.abs(tx.amount ?? 0),
        category: tx.category || "",
        subCategory: tx.meta?.subCategory || null,
        description: tx.descriptionVia || "",
        date: tx.date,
        transactionType: manualMeta?.transactionType || (tx.amount < 0 ? "expense" : "income"),
        loanTo: manualMeta?.loanTo || null,
        loanFrom: manualMeta?.loanFrom || null,
        createdAt: tx.createdAt,
      };
    });
    const filtered = mapped.filter((tx) => {
      if (cardId && tx.cardId !== String(cardId)) return false;
      if (transactionType && tx.transactionType !== String(transactionType)) return false;
      return true;
    });
    const capped = limit ? filtered.slice(0, takeCount) : filtered;
    res.json(capped);
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

app.get("/api/transactions/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const transaction = await prisma.bankTransaction.findFirst({
      where: {
        id: req.params.id,
        userId,
        providerTransactionId: { startsWith: "manual-" },
      },
      include: { meta: true },
    });
    if (!transaction) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    const manualMeta = getManualRawMeta(transaction.raw);
    res.json({
      id: transaction.id,
      userId: transaction.userId,
      cardId: manualMeta?.cardId || null,
      providerTxId: transaction.providerTransactionId || null,
      merchant: transaction.merchant || "",
      amount: Math.abs(transaction.amount ?? 0),
      category: transaction.category || "",
      subCategory: transaction.meta?.subCategory || null,
      description: transaction.descriptionVia || "",
      date: transaction.date,
      transactionType: manualMeta?.transactionType || (transaction.amount < 0 ? "expense" : "income"),
      loanTo: manualMeta?.loanTo || null,
      loanFrom: manualMeta?.loanFrom || null,
      createdAt: transaction.createdAt,
    });
  } catch (error) {
    console.error("Failed to fetch transaction:", error);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

app.post("/api/transactions", async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body || {};
    if (!payload.merchant || payload.amount === undefined || !payload.category) {
      res.status(400).json({ error: "merchant, amount, and category are required" });
      return;
    }
    const amountInput = Number(payload.amount);
    if (!Number.isFinite(amountInput)) {
      res.status(400).json({ error: "amount must be a valid number" });
      return;
    }
    const transactionType = payload.transactionType || "expense";
    const { account, card } = await resolveManualAccountForTransaction(userId, payload.cardId || null);
    if (payload.cardId && !card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }
    const signedAmount =
      transactionType === "expense" || transactionType === "loan_given"
        ? -Math.abs(amountInput)
        : Math.abs(amountInput);
    await ensureUserCategory(userId, payload.category);
    const hasSubCategory = Object.prototype.hasOwnProperty.call(payload, "subCategory");
    await prisma.$transaction(async (tx) => {
      await tx.bankTransaction.create({
        data: {
          userId,
          accountId: account.id,
          providerTransactionId: `manual-${Date.now()}`,
          merchant: payload.merchant,
          amount: signedAmount,
          direction: signedAmount < 0 ? "debit" : "credit",
          category: payload.category,
          descriptionVia: payload.description || null,
          date: payload.date ? new Date(payload.date) : new Date(),
          raw: buildManualRaw({
            cardId: card?.id || null,
            transactionType,
            loanTo: payload.loanTo || null,
            loanFrom: payload.loanFrom || null,
          }),
          meta: hasSubCategory
            ? {
                create: {
                  userId,
                  subCategory: payload.subCategory || null,
                },
              }
            : undefined,
        },
      });
      if (transactionType === "expense" && card?.id) {
        await tx.card.update({
          where: { id: card.id },
          data: { balance: { increment: Math.abs(amountInput) } },
        });
      }
    });
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Failed to create transaction:", error);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

app.put("/api/transactions/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body || {};
    const oldTransaction = await prisma.bankTransaction.findFirst({
      where: { id: req.params.id, userId },
      include: { meta: true },
    });
    if (!oldTransaction) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    const isManual =
      typeof oldTransaction.providerTransactionId === "string" &&
      oldTransaction.providerTransactionId.startsWith("manual-");
    if (!isManual) {
      res.status(403).json({ error: "Only manual transactions can be updated." });
      return;
    }
    const oldManualMeta = getManualRawMeta(oldTransaction.raw);
    const oldCardId = oldManualMeta?.cardId || null;
    const oldTransactionType = oldManualMeta?.transactionType || (oldTransaction.amount < 0 ? "expense" : "income");
    const nextCardId =
      payload.cardId === undefined ? oldCardId : payload.cardId ? String(payload.cardId) : null;
    const { account, card } = await resolveManualAccountForTransaction(userId, nextCardId);
    if (nextCardId && !card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }
    const nextTransactionType = payload.transactionType || oldTransactionType || "expense";
    const amountInput =
      payload.amount !== undefined ? Number(payload.amount) : Math.abs(oldTransaction.amount);
    if (!Number.isFinite(amountInput)) {
      res.status(400).json({ error: "amount must be a valid number" });
      return;
    }
    const signedAmount =
      nextTransactionType === "expense" || nextTransactionType === "loan_given"
        ? -Math.abs(amountInput)
        : Math.abs(amountInput);
    if (payload.category) {
      await ensureUserCategory(userId, payload.category);
    }
    const hasSubCategory = Object.prototype.hasOwnProperty.call(payload, "subCategory");
    await prisma.$transaction(async (tx) => {
      await tx.bankTransaction.update({
        where: { id: req.params.id },
        data: {
          accountId: account.id,
          merchant: payload.merchant ?? oldTransaction.merchant,
          amount: signedAmount,
          direction: signedAmount < 0 ? "debit" : "credit",
          category: payload.category ?? oldTransaction.category,
          descriptionVia: payload.description ?? oldTransaction.descriptionVia,
          date: payload.date ? new Date(payload.date) : oldTransaction.date,
          raw: buildManualRaw({
            cardId: card?.id || null,
            transactionType: nextTransactionType,
            loanTo: payload.loanTo ?? oldManualMeta?.loanTo,
            loanFrom: payload.loanFrom ?? oldManualMeta?.loanFrom,
          }),
          meta: hasSubCategory
            ? {
                upsert: {
                  create: {
                    userId,
                    subCategory: payload.subCategory || null,
                  },
                  update: {
                    subCategory: payload.subCategory || null,
                  },
                },
              }
            : undefined,
        },
      });

      const oldEffect = oldTransactionType === "expense" ? Math.abs(oldTransaction.amount) : 0;
      const newEffect = nextTransactionType === "expense" ? Math.abs(signedAmount) : 0;
      if (oldCardId && oldEffect > 0) {
        await tx.card.update({
          where: { id: oldCardId },
          data: { balance: { decrement: oldEffect } },
        });
      }
      if (card?.id && newEffect > 0) {
        await tx.card.update({
          where: { id: card.id },
          data: { balance: { increment: newEffect } },
        });
      }
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to update transaction:", error);
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

app.delete("/api/transactions/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await prisma.bankTransaction.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    const isManual =
      typeof existing.providerTransactionId === "string" &&
      existing.providerTransactionId.startsWith("manual-");
    if (!isManual) {
      res.status(403).json({ error: "Only manual transactions can be deleted." });
      return;
    }
    const manualMeta = getManualRawMeta(existing.raw);
    const cardId = manualMeta?.cardId || null;
    const transactionType =
      manualMeta?.transactionType || (existing.amount < 0 ? "expense" : "income");
    await prisma.$transaction(async (tx) => {
      await tx.bankTransaction.delete({ where: { id: req.params.id } });
      if (transactionType === "expense" && cardId) {
        await tx.card.update({
          where: { id: cardId },
          data: { balance: { decrement: Math.abs(existing.amount) } },
        });
      }
    });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete transaction:", error);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

app.get("/api/analytics/spending-by-category", async (req, res) => {
  try {
    const userId = req.user.id;
    const transactions = await prisma.bankTransaction.findMany({
      where: { userId },
      select: { category: true, amount: true },
    });
    const categoryTotals = transactions.reduce((acc, transaction) => {
      const key = transaction.category || "Uncategorized";
      acc[key] = (acc[key] || 0) + Math.abs(transaction.amount);
      return acc;
    }, {});
    const data = Object.entries(categoryTotals).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }));
    res.json(data);
  } catch (error) {
    console.error("Failed to fetch spending by category:", error);
    res.status(500).json({ error: "Failed to fetch spending by category" });
  }
});

app.get("/api/analytics/monthly", async (req, res) => {
  try {
    const userId = req.user.id;
    const transactions = await prisma.bankTransaction.findMany({
      where: { userId },
      select: { date: true, amount: true },
      orderBy: { date: "asc" },
    });
    const monthlyTotals = transactions.reduce((acc, transaction) => {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      acc[monthKey] = (acc[monthKey] || 0) + Math.abs(transaction.amount);
      return acc;
    }, {});
    const data = Object.entries(monthlyTotals)
      .map(([month, total]) => ({
        month,
        total: Number(total.toFixed(2)),
      }))
      .slice(-6);
    res.json(data);
  } catch (error) {
    console.error("Failed to fetch monthly spending:", error);
    res.status(500).json({ error: "Failed to fetch monthly spending" });
  }
});

app.get("/api/analytics/by-card", async (req, res) => {
  try {
    const userId = req.user.id;
    const transactions = await prisma.bankTransaction.findMany({
      where: { userId },
      include: { account: true },
    });
    const cardTotals = transactions.reduce((acc, transaction) => {
      const name = transaction.account?.name || transaction.account?.type || "Account";
      const helper = transaction.account?.mask ? ` (••${transaction.account.mask})` : "";
      const label = `${name}${helper}`;
      acc[label] = (acc[label] || 0) + Math.abs(transaction.amount);
      return acc;
    }, {});
    const data = Object.entries(cardTotals).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }));
    res.json(data);
  } catch (error) {
    console.error("Failed to fetch spending by card:", error);
    res.status(500).json({ error: "Failed to fetch spending by card" });
  }
});

app.get("/api/analytics/by-merchant", async (req, res) => {
  try {
    const userId = req.user.id;
    const transactions = await prisma.bankTransaction.findMany({
      where: { userId },
      select: { merchant: true, descriptionVia: true, amount: true },
    });
    const merchantTotals = transactions.reduce((acc, transaction) => {
      const key = transaction.merchant || transaction.descriptionVia || "Unknown";
      acc[key] = (acc[key] || 0) + Math.abs(transaction.amount);
      return acc;
    }, {});
    const data = Object.entries(merchantTotals)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
    res.json(data);
  } catch (error) {
    console.error("Failed to fetch spending by merchant:", error);
    res.status(500).json({ error: "Failed to fetch spending by merchant" });
  }
});

app.get("/api/insights", async (req, res) => {
  try {
    const userId = req.user.id;
    const insights = [];
    const cards = await prisma.card.findMany({ where: { userId } });
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        userId,
        date: {
          gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
        },
      },
    });

    const totalBalance = cards.reduce((acc, card) => acc + card.balance, 0);
    const totalLimit = cards.reduce((acc, card) => acc + card.limit, 0);
    const utilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;

    if (utilization > 80) {
      insights.push({
        type: "alert",
        title: "High Credit Utilization",
        message: `Your credit utilization is ${utilization.toFixed(1)}%, which is above the recommended 30%. Consider paying down balances to improve your credit score.`,
      });
    } else if (utilization > 50) {
      insights.push({
        type: "alert",
        title: "Moderate Credit Utilization",
        message: `Your credit utilization is ${utilization.toFixed(1)}%. Keeping it below 30% is ideal for credit health.`,
      });
    }

    const cardUtilizations = cards
      .filter((card) => card.limit > 0)
      .map((card) => ({
        card,
        utilization: (card.balance / card.limit) * 100,
      }))
      .sort((a, b) => b.utilization - a.utilization);

    if (cardUtilizations.length > 0 && cardUtilizations[0].utilization > 70) {
      insights.push({
        type: "tip",
        title: "Card Balance Alert",
        message: `Your ${cardUtilizations[0].card.name} has a ${cardUtilizations[0].utilization.toFixed(1)}% utilization. Consider paying it down to free up credit.`,
      });
    }

    const categoryTotals = transactions.reduce((acc, transaction) => {
      const key = transaction.category || "Uncategorized";
      const amount = transaction.amount < 0 ? Math.abs(transaction.amount) : transaction.amount;
      acc[key] = (acc[key] || 0) + amount;
      return acc;
    }, {});

    const sortedCategories = Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    if (sortedCategories.length > 0) {
      const topCategory = sortedCategories[0];
      insights.push({
        type: "insight",
        title: "Top Spending Category",
        message: `You've spent $${topCategory.amount.toFixed(2)} on ${topCategory.category} this month. This is your highest spending category.`,
      });
    }

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const lastMonth = new Date(currentMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const currentMonthSpending = transactions
      .filter((t) => new Date(t.date) >= currentMonth)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const lastMonthTransactions = await prisma.bankTransaction.findMany({
      where: {
        userId,
        date: {
          gte: lastMonth,
          lt: currentMonth,
        },
      },
    });

    const lastMonthSpending = lastMonthTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    if (lastMonthSpending > 0) {
      const change = ((currentMonthSpending - lastMonthSpending) / lastMonthSpending) * 100;
      if (Math.abs(change) > 10) {
        insights.push({
          type: change > 0 ? "alert" : "insight",
          title: "Spending Trend",
          message: `Your spending this month is ${Math.abs(change).toFixed(1)}% ${change > 0 ? "higher" : "lower"} than last month. ${change > 0 ? "Consider reviewing your expenses." : "Great job managing your spending!"}`,
        });
      }
    }

    if (cards.length > 1) {
      const cardWithLowestUtilization = cards
        .filter((card) => card.limit > 0)
        .map((card) => ({
          card,
          utilization: (card.balance / card.limit) * 100,
        }))
        .sort((a, b) => a.utilization - b.utilization)[0];

      if (cardWithLowestUtilization && cardWithLowestUtilization.utilization < 30) {
        insights.push({
          type: "tip",
          title: "Card Recommendation",
          message: `Consider using your ${cardWithLowestUtilization.card.name} for new purchases. It has the lowest utilization at ${cardWithLowestUtilization.utilization.toFixed(1)}%.`,
        });
      }
    }

    if (insights.length === 0) {
      insights.push({
        type: "insight",
        title: "Getting Started",
        message: "Keep tracking your transactions to receive personalized insights and recommendations.",
      });
    }

    res.json(insights.slice(0, 3));
  } catch (error) {
    console.error("Failed to generate insights:", error);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
