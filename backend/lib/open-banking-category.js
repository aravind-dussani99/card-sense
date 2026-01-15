const STANDARD_CATEGORIES = [
  "AI Tools",
  "Fuel",
  "Groceries",
  "Dining",
  "Travel",
  "Shopping",
  "Bills",
  "Transfers",
  "Cash",
  "Subscriptions",
  "Entertainment",
  "Health",
  "Fitness",
  "Education",
  "Income",
  "Other",
];

const KEYWORD_MAP = [
  { category: "AI Tools", terms: ["openai", "cursor", "anthropic", "chatgpt", "copilot", "midjourney"] },
  { category: "Fitness", terms: ["puregym", "gym", "fitness"] },
  { category: "Entertainment", terms: ["netflix", "spotify", "prime", "youtube", "disney", "cinema", "vue", "theatre", "game", "entertainment"] },
  { category: "Subscriptions", terms: ["subscription", "membership", "office", "microsoft 365", "adobe", "icloud", "dropbox", "notion"] },
  { category: "Fuel", terms: ["fuel", "petrol", "diesel", "shell", "esso", "bp", "texaco"] },
  { category: "Groceries", terms: ["tesco", "asda", "sainsbury", "aldi", "lidl", "morrisons", "waitrose", "grocery"] },
  { category: "Dining", terms: ["restaurant", "cafe", "coffee", "pizza", "kfc", "mcdonald", "uber eats", "deliveroo", "just eat"] },
  { category: "Travel", terms: ["uber", "bolt", "train", "rail", "flight", "air", "hotel", "booking.com", "easyjet", "ryanair", "mytrip"] },
  { category: "Bills", terms: ["electric", "gas", "water", "council tax", "internet", "broadband", "utility"] },
  { category: "Transfers", terms: ["transfer", "bank transfer", "faster payment", "standing order"] },
  { category: "Cash", terms: ["atm", "cash withdrawal"] },
  { category: "Health", terms: ["pharmacy", "doctor", "hospital", "clinic", "dentist"] },
  { category: "Education", terms: ["tuition", "course", "udemy", "coursera", "education"] },
  { category: "Shopping", terms: ["amazon", "ebay", "ikea", "argos", "store", "retail"] },
];

const PROVIDER_CATEGORY_MAP = {
  card_payment: "Shopping",
  purchase: "Shopping",
  transfer: "Transfers",
  cash: "Cash",
  cash_withdrawal: "Cash",
  atm: "Cash",
  bills: "Bills",
  income: "Income",
  credit: "Income",
  debit: "Other",
  subscription: "Subscriptions",
  entertainment: "Entertainment",
  travel: "Travel",
  restaurant: "Dining",
  restaurants: "Dining",
  food_and_drink: "Dining",
  groceries: "Groceries",
  supermarkets: "Groceries",
  fuel: "Fuel",
  motor_fuel: "Fuel",
  transport: "Travel",
  utilities: "Bills",
};

const MCC_CATEGORY_MAP = {
  "5411": "Groceries",
  "5499": "Groceries",
  "5541": "Fuel",
  "5542": "Fuel",
  "5812": "Dining",
  "5814": "Dining",
  "5912": "Health",
  "4111": "Travel",
  "4121": "Travel",
  "4722": "Travel",
  "4900": "Bills",
};

const normalize = (value) => (value || "").toLowerCase().trim();

const normalizeMerchantToken = (value) =>
  normalize(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function buildMerchantKey(tx) {
  const label = tx.merchant_name || tx.merchant || tx.description || tx.counterparty?.name || tx.reference || "";
  return normalizeMerchantToken(label) || "";
}

export function getProviderCategory(tx) {
  const candidate = [tx.transaction_category, tx.category, tx.transaction_type, tx.type]
    .flat()
    .filter(Boolean)
    .map((value) => normalize(String(value)));
  return candidate.find((value) => value) || null;
}

export function mapOpenBankingCategory(tx) {
  const candidate = [tx.transaction_category, tx.category, tx.transaction_type, tx.type]
    .flat()
    .filter(Boolean)
    .map((value) => normalize(String(value)));
  const mccCode = tx.merchant_category_code ? String(tx.merchant_category_code) : "";
  if (mccCode && MCC_CATEGORY_MAP[mccCode]) {
    return MCC_CATEGORY_MAP[mccCode];
  }

  const haystack = normalize(
    [tx.merchant_name, tx.description, tx.counterparty?.name, tx.reference].filter(Boolean).join(" ")
  );
  for (const { category, terms } of KEYWORD_MAP) {
    if (terms.some((term) => haystack.includes(term))) {
      return category;
    }
  }

  for (const value of candidate) {
    if (PROVIDER_CATEGORY_MAP[value]) return PROVIDER_CATEGORY_MAP[value];
    const hit = Object.entries(PROVIDER_CATEGORY_MAP).find(([key]) => value.includes(key));
    if (hit) return hit[1];
  }

  return STANDARD_CATEGORIES.includes(tx.category) ? tx.category : "Other";
}

export function mapOpenBankingCategoryFromRecord(record) {
  let parsed = {};
  if (record.raw) {
    try {
      parsed = JSON.parse(record.raw);
    } catch {
      parsed = {};
    }
  }
  if (!parsed.description && record.descriptionVia) parsed.description = record.descriptionVia;
  if (!parsed.merchant_name && record.merchant) parsed.merchant_name = record.merchant;
  return mapOpenBankingCategory(parsed);
}
