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
} from "./lib/open-banking-category.js";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8081;

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

const resolveTransactionCategory = async (tx) => {
  const merchantKey = buildMerchantKey(tx);
  const providerCategory = getProviderCategory(tx);
  const mcc = tx.merchant_category_code ? String(tx.merchant_category_code) : null;

  let rule = null;
  if (merchantKey) {
    rule = await prisma.merchantCategoryRule.findUnique({
      where: { merchantKey },
    });
  }

  const mapped = rule?.category || mapOpenBankingCategory(tx);

  if (merchantKey && (providerCategory || mcc)) {
    await prisma.merchantCategoryRule.upsert({
      where: { merchantKey },
      update: {
        category: mapped,
        source: providerCategory ? "provider" : "mcc",
      },
      create: {
        merchantKey,
        category: mapped,
        source: providerCategory ? "provider" : "mcc",
      },
    });
  }

  return mapped;
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

app.get("/api/cards", async (_req, res) => {
  try {
    const cards = await prisma.card.findMany({
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
    const payload = req.body || {};
    if (!payload.name || !payload.bank || !payload.last4) {
      res.status(400).json({ error: "name, bank, and last4 are required" });
      return;
    }
    const card = await prisma.card.create({
      data: {
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
    const card = await prisma.card.update({
      where: { id: req.params.id },
      data: req.body || {},
    });
    res.json(card);
  } catch (error) {
    console.error("Failed to update card:", error);
    res.status(500).json({ error: "Failed to update card" });
  }
});

app.delete("/api/cards/:id", async (req, res) => {
  try {
    await prisma.card.delete({ where: { id: req.params.id } });
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

app.get("/api/categories", async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
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

app.post("/api/categories", async (req, res) => {
  try {
    const { name, icon, color } = req.body || {};
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const category = await prisma.category.create({
      data: { name, icon: icon || null, color: color || null },
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    console.error("Failed to create category:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

app.put("/api/categories/:id", async (req, res) => {
  try {
    const { name, icon, color } = req.body || {};
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { name, icon: icon || null, color: color || null },
    });
    res.json({ success: true, data: category });
  } catch (error) {
    console.error("Failed to update category:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete category:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

app.post("/api/categories/:id/subcategories", async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) {
      res.status(400).json({ error: "name is required" });
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
    const { name } = req.body || {};
    const subCategory = await prisma.subCategory.update({
      where: { id: req.params.id },
      data: { name },
    });
    res.json({ success: true, data: subCategory });
  } catch (error) {
    console.error("Failed to update sub-category:", error);
    res.status(500).json({ error: "Failed to update sub-category" });
  }
});

app.delete("/api/subcategories/:id", async (req, res) => {
  try {
    await prisma.subCategory.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete sub-category:", error);
    res.status(500).json({ error: "Failed to delete sub-category" });
  }
});

app.get("/api/bank/connections", async (req, res) => {
  try {
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    const connections = await prisma.bankConnection.findMany({
      where: userId ? { userId } : undefined,
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
    await prisma.bankConnection.deleteMany({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete bank connection:", error);
    res.status(500).json({ error: "Failed to delete bank connection" });
  }
});

app.delete("/api/bank/accounts/:id", async (req, res) => {
  try {
    await prisma.bankAccount.update({
      where: { id: req.params.id },
      data: { status: "deleted" },
    });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete bank account:", error);
    res.status(500).json({ error: "Failed to delete bank account" });
  }
});

app.get("/api/bank/accounts", async (_req, res) => {
  try {
    const accounts = await prisma.bankAccount.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      include: { connection: true },
    });
    res.json(accounts);
  } catch (error) {
    console.error("Failed to fetch bank accounts:", error);
    res.status(500).json({ error: "Failed to fetch bank accounts" });
  }
});

app.post("/api/bank/accounts", async (req, res) => {
  try {
    const { name, type, bankName, mask, currency, userId, balance, availableBalance, limit } = req.body || {};
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const ownerId = userId || "local-user";
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
        connectionId: connection.id,
        providerAccountId: `manual-${crypto.randomUUID()}`,
        type: type || "account",
        name,
        currency: currency || null,
        mask: mask || null,
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
    const body = req.body || {};
    const data = {};
    if (typeof body.name === "string") data.name = body.name;
    if (typeof body.type === "string") data.type = body.type;
    if (typeof body.currency === "string") data.currency = body.currency;
    if (typeof body.mask === "string") data.mask = body.mask;
    if (typeof body.tags === "string") data.tags = body.tags;
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
    const account = await prisma.bankAccount.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: account });
  } catch (error) {
    console.error("Failed to update bank account:", error);
    res.status(500).json({ error: "Failed to update bank account" });
  }
});

app.get("/api/credentials/accounts", async (req, res) => {
  try {
    const bankAccountId = req.query.bankAccountId ? String(req.query.bankAccountId) : undefined;
    const includePayload = String(req.query.includePayload || "") === "true";
    const credentials = await prisma.bankAccountCredential.findMany({
      where: bankAccountId ? { bankAccountId } : undefined,
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
    const { bankAccountId, label, encryptedPayload } = req.body || {};
    if (!bankAccountId || !encryptedPayload) {
      res.status(400).json({ error: "bankAccountId and encryptedPayload are required" });
      return;
    }
    const record = await prisma.bankAccountCredential.upsert({
      where: { bankAccountId },
      update: { label: label || null, encryptedPayload },
      create: { bankAccountId, label: label || null, encryptedPayload },
    });
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error("Failed to store account credentials:", error);
    res.status(500).json({ error: "Failed to store account credentials" });
  }
});

app.get("/api/credentials/cards", async (req, res) => {
  try {
    const cardId = req.query.cardId ? String(req.query.cardId) : undefined;
    const includePayload = String(req.query.includePayload || "") === "true";
    const credentials = await prisma.cardCredential.findMany({
      where: cardId ? { cardId } : undefined,
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
    const { cardId, label, encryptedPayload } = req.body || {};
    if (!cardId || !encryptedPayload) {
      res.status(400).json({ error: "cardId and encryptedPayload are required" });
      return;
    }
    const record = await prisma.cardCredential.upsert({
      where: { cardId },
      update: { label: label || null, encryptedPayload },
      create: { cardId, label: label || null, encryptedPayload },
    });
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error("Failed to store card credentials:", error);
    res.status(500).json({ error: "Failed to store card credentials" });
  }
});

app.post("/api/bank/exchange", async (req, res) => {
  try {
    const { code, userId, redirectUri } = req.body || {};
    if (!code || !userId) {
      res.status(400).json({ success: false, error: "code and userId are required" });
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
    const userId = req.query.userId ? String(req.query.userId) : state || "sandbox-user";
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
      await prisma.bankAccount.upsert({
        where: { providerAccountId: acct.account_id },
        update: {
          connectionId: connection.id,
          type: acct.account_type || acct.type || null,
          name: acct.display_name || acct.account_id || null,
          currency: acct.currency || null,
          mask: acct.account_number?.iban || acct.account_number?.number?.slice(-4) || null,
          status: "active",
          ...balancePatch,
        },
        create: {
          connectionId: connection.id,
          providerAccountId: acct.account_id,
          type: acct.account_type || acct.type || null,
          name: acct.display_name || acct.account_id || null,
          currency: acct.currency || null,
          mask: acct.account_number?.iban || acct.account_number?.number?.slice(-4) || null,
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
        where: { providerAccountId: providerId },
        update: {
          connectionId: connection.id,
          type: "card",
          name: card.display_name || card.name_on_card || card.card_network || card.card_type || null,
          currency: card.currency || null,
          mask: card.partial_card_number || card.card_number?.slice(-4) || null,
          status: "active",
          ...cardBalancePatch,
        },
        create: {
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
      const accountId = await ensureAccountId(connection.id, acct.account_id, "account");
      for (const tx of txns) {
        const providerTransactionId = tx.transaction_id || tx.id || tx.normalised_provider_transaction_id;
        if (!providerTransactionId) continue;
        const rawString = JSON.stringify(tx);
        const direction = tx.amount?.value && tx.amount.value < 0 ? "debit" : "credit";
        const mappedCategory = await resolveTransactionCategory(tx);
        const runningBalance = parseAmount(tx.running_balance ?? tx.balance ?? null);
        await prisma.bankTransaction.upsert({
          where: { providerTransactionId },
          update: {
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
      const accountId = await ensureAccountId(connection.id, providerId, "card");
      for (const tx of txns) {
        const providerTransactionId = tx.transaction_id || tx.id || tx.normalised_provider_transaction_id;
        if (!providerTransactionId) continue;
        const rawString = JSON.stringify(tx);
        const direction = tx.amount?.value && tx.amount.value < 0 ? "debit" : "credit";
        const mappedCategory = await resolveTransactionCategory(tx);
        const runningBalance = parseAmount(tx.running_balance ?? tx.balance ?? null);
        await prisma.bankTransaction.upsert({
          where: { providerTransactionId },
          update: {
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
    const { userId, accountId, fromDate, toDate } = req.body || {};
    let connections;
    if (accountId) {
      const acct = await prisma.bankAccount.findUnique({
        where: { id: accountId },
        include: { connection: true },
      });
      if (!acct || !acct.connection) {
        res.status(400).json({ success: false, error: "Account not found or missing connection" });
        return;
      }
      connections = [acct.connection];
    } else {
      connections = await prisma.bankConnection.findMany({
        where: userId ? { userId } : undefined,
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
              type: acct.account_type || acct.type || "account",
              name: acct.display_name || acct.account_id,
              currency: acct.currency,
              mask: acct.account_number?.iban || acct.account_number?.number?.slice(-4),
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
          const account = await prisma.bankAccount.upsert({
            where: { providerAccountId: acct.id },
            update: {
              connectionId: connection.id,
              type: acct.type,
              name: acct.name,
              currency: acct.currency,
              mask: acct.mask,
              status: "active",
              ...balancePatch,
            },
            create: {
              connectionId: connection.id,
              providerAccountId: acct.id,
              type: acct.type,
              name: acct.name,
              currency: acct.currency,
              mask: acct.mask,
              status: "active",
              balance: balancePatch.balance ?? 0,
              availableBalance: balancePatch.availableBalance ?? null,
              limit: balancePatch.limit ?? null,
            },
          });

          if (accountId && acct.id !== account.providerAccountId) continue;

          const txns =
            acct.type === "card"
              ? await fetchCardTransactions(connection.accessToken, acct.id, fromDate, toDate).catch(() => [])
              : await fetchTransactions(connection.accessToken, acct.id, fromDate, toDate).catch(() => []);
          for (const tx of txns) {
            const providerTransactionId = tx.transaction_id || tx.id || tx.normalised_provider_transaction_id;
            if (!providerTransactionId) continue;
            const rawString = JSON.stringify(tx);
            const direction = tx.amount?.value && tx.amount.value < 0 ? "debit" : "credit";
            const mappedCategory = await resolveTransactionCategory(tx);
            const runningBalance = parseAmount(tx.running_balance ?? tx.balance ?? null);
            await prisma.bankTransaction.upsert({
              where: { providerTransactionId },
              update: {
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
              accountId: account.id,
              ...(fromDate || toDate
                ? {
                    date: {
                      ...(fromDate ? { gte: new Date(fromDate) } : {}),
                      ...(toDate ? { lte: new Date(toDate) } : {}),
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
              ? await prisma.merchantCategoryRule.findUnique({ where: { merchantKey } })
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

async function ensureAccountId(connectionId, providerAccountId, type) {
  const existing = await prisma.bankAccount.findUnique({ where: { providerAccountId } });
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
    const page = Number(req.query.page || "1");
    const pageSize = Number(req.query.pageSize || "15");
    const search = req.query.search ? String(req.query.search) : undefined;
    const accountId = req.query.accountId ? String(req.query.accountId) : undefined;
    const category = req.query.categoryId ? String(req.query.categoryId) : undefined;
    const fromDate = req.query.fromDate ? String(req.query.fromDate) : undefined;
    const toDate = req.query.toDate ? String(req.query.toDate) : undefined;

    const where = {};
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
    if (fromDate || toDate) {
      where.date = {
        ...(fromDate ? { gte: new Date(fromDate) } : {}),
        ...(toDate ? { lte: new Date(toDate) } : {}),
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

    res.json({
      success: true,
      data: drafts,
      meta: { total, page, pageSize },
    });
  } catch (error) {
    console.error("transactions drafts GET error", error);
    res.status(500).json({ success: false, error: "Failed to load transactions" });
  }
});

app.post("/api/transactions/drafts", async (req, res) => {
  try {
    const body = req.body || {};
    const amount = typeof body.amount === "number" ? body.amount : Number(body.amount || 0);
    const bookingDate = body.date ? new Date(String(body.date)) : new Date();
    const headAccount = typeof body.headAccount === "string" ? body.headAccount.trim() : "";
    if (!headAccount) {
      res.status(400).json({ success: false, error: "Head Account is required." });
      return;
    }
    const attachments =
      Array.isArray(body.attachments) ? body.attachments : typeof body.attachments === "string" ? body.attachments.split(",") : [];
    const cleanedAttachments = attachments
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    const created = await prisma.bankTransaction.create({
      data: {
        id: `manual-${Date.now()}`,
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

app.patch("/api/transactions/drafts/:id", async (req, res) => {
  try {
    const body = req.body || {};
    const data = {};
    if (typeof body.merchantTo === "string") data.merchant = body.merchantTo;
    if (typeof body.merchant === "string") data.merchant = body.merchant;
    if (body.amount !== undefined && body.amount !== null && !Number.isNaN(Number(body.amount))) {
      data.amount = Number(body.amount);
    }
    if (typeof body.category === "string") data.category = body.category;
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
    const updated = await prisma.bankTransaction.update({
      where: { id: req.params.id },
      data: {
        ...data,
        meta: Object.keys(metaUpdate).length
          ? {
              upsert: {
                create: metaUpdate,
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
    const existing = await prisma.bankTransaction.findUnique({ where: { id: req.params.id } });
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
    const bankTx = await prisma.bankTransaction.findUnique({
      where: { id: req.params.id },
      include: { account: true },
    });
    if (!bankTx) {
      res.status(404).json({ success: false, error: "Transaction not found" });
      return;
    }

    const providerTxId = bankTx.providerTransactionId || undefined;
    if (providerTxId) {
      const existing = await prisma.transaction.findUnique({
        where: { providerTxId },
        select: { id: true },
      });
      if (existing) {
        res.json({ success: true, alreadyApproved: true });
        return;
      }
    }

    const amount = bankTx.amount ?? 0;
    const merchant = bankTx.merchant || bankTx.descriptionVia || "Unknown";
    await prisma.transaction.create({
      data: {
        cardId: null,
        providerTxId: providerTxId || null,
        merchant,
        amount: Math.abs(amount),
        category: bankTx.category || "Uncategorized",
        subCategory: null,
        description: bankTx.descriptionVia || "",
        date: bankTx.date ? new Date(bankTx.date) : new Date(),
        transactionType: amount < 0 ? "expense" : "income",
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("transactions approve error", error);
    res.status(500).json({ success: false, error: "Failed to approve transaction" });
  }
});

app.get("/api/transactions", async (req, res) => {
  try {
    const { cardId, category, transactionType, dateFrom, dateTo, limit } = req.query;
    const where = {};
    if (cardId) where.cardId = String(cardId);
    if (category) where.category = String(category);
    if (transactionType) where.transactionType = String(transactionType);
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(String(dateFrom));
      if (dateTo) where.date.lte = new Date(String(dateTo));
    }
    const transactions = await prisma.transaction.findMany({
      where,
      include: { card: true },
      orderBy: { date: "desc" },
      take: limit ? Number(limit) : 1000,
    });
    res.json(transactions);
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

app.get("/api/transactions/:id", async (req, res) => {
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: { card: true },
    });
    if (!transaction) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    res.json(transaction);
  } catch (error) {
    console.error("Failed to fetch transaction:", error);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

app.post("/api/transactions", async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.merchant || payload.amount === undefined || !payload.category) {
      res.status(400).json({ error: "merchant, amount, and category are required" });
      return;
    }
    const transactionType = payload.transactionType || "expense";
    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          cardId: payload.cardId || null,
          merchant: payload.merchant,
          amount: Number(payload.amount),
          category: payload.category,
          subCategory: payload.subCategory || null,
          description: payload.description || "",
          date: payload.date ? new Date(payload.date) : new Date(),
          transactionType,
          loanTo: payload.loanTo || null,
          loanFrom: payload.loanFrom || null,
        },
      });
      if (transactionType === "expense" && payload.cardId) {
        await tx.card.update({
          where: { id: payload.cardId },
          data: { balance: { increment: Number(payload.amount) } },
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
    const payload = req.body || {};
    const oldTransaction = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!oldTransaction) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: req.params.id },
        data: {
          cardId: payload.cardId || null,
          merchant: payload.merchant,
          amount: Number(payload.amount),
          category: payload.category,
          subCategory: payload.subCategory || null,
          description: payload.description || "",
          date: payload.date ? new Date(payload.date) : new Date(),
          transactionType: payload.transactionType || "expense",
          loanTo: payload.loanTo || null,
          loanFrom: payload.loanFrom || null,
        },
      });

      const transactionType = payload.transactionType || "expense";
      const oldTransactionType = oldTransaction.transactionType || "expense";
      if (transactionType === "expense" || oldTransactionType === "expense") {
        const amountDiff = Number(payload.amount) - oldTransaction.amount;
        if (oldTransaction.cardId !== payload.cardId) {
          if (oldTransaction.cardId && oldTransactionType === "expense") {
            await tx.card.update({
              where: { id: oldTransaction.cardId },
              data: { balance: { decrement: oldTransaction.amount } },
            });
          }
          if (payload.cardId && transactionType === "expense") {
            await tx.card.update({
              where: { id: payload.cardId },
              data: { balance: { increment: Number(payload.amount) } },
            });
          }
        } else if (payload.cardId && transactionType === "expense") {
          await tx.card.update({
            where: { id: payload.cardId },
            data: { balance: { increment: amountDiff } },
          });
        }
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
    const existing = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id: req.params.id } });
      if (existing.transactionType === "expense" && existing.cardId) {
        await tx.card.update({
          where: { id: existing.cardId },
          data: { balance: { decrement: existing.amount } },
        });
      }
    });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete transaction:", error);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

app.get("/api/analytics/spending-by-category", async (_req, res) => {
  try {
    const transactions = await prisma.bankTransaction.findMany({
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

app.get("/api/analytics/monthly", async (_req, res) => {
  try {
    const transactions = await prisma.bankTransaction.findMany({
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

app.get("/api/analytics/by-card", async (_req, res) => {
  try {
    const transactions = await prisma.bankTransaction.findMany({
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

app.get("/api/analytics/by-merchant", async (_req, res) => {
  try {
    const transactions = await prisma.bankTransaction.findMany({
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

app.get("/api/insights", async (_req, res) => {
  try {
    const insights = [];
    const cards = await prisma.card.findMany();
    const transactions = await prisma.bankTransaction.findMany({
      where: {
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
