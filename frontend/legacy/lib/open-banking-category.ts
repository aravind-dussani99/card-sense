type RawTransaction = Record<string, any>;

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

const KEYWORD_MAP: Array<{ category: string; terms: string[] }> = [
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

const PROVIDER_CATEGORY_MAP: Record<string, string> = {
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
    groceries: "Groceries",
    fuel: "Fuel",
};

const normalize = (value?: string | null) => (value || "").toLowerCase().trim();

export function mapOpenBankingCategory(tx: RawTransaction): string {
    const candidate = [
        tx.transaction_category,
        tx.category,
        tx.transaction_type,
        tx.type,
    ]
        .flat()
        .filter(Boolean)
        .map((v) => normalize(String(v)));

    const haystack = normalize(
        [tx.merchant_name, tx.description, tx.counterparty?.name, tx.reference].filter(Boolean).join(" ")
    );
    for (const { category, terms } of KEYWORD_MAP) {
        if (terms.some((term) => haystack.includes(term))) {
            return category;
        }
    }

    for (const c of candidate) {
        if (PROVIDER_CATEGORY_MAP[c]) return PROVIDER_CATEGORY_MAP[c];
        const hit = Object.entries(PROVIDER_CATEGORY_MAP).find(([key]) => c.includes(key));
        if (hit) return hit[1];
    }

    return STANDARD_CATEGORIES.includes(tx.category) ? tx.category : "Other";
}

export function mapOpenBankingCategoryFromRecord(record: {
    raw?: string | null;
    merchant?: string | null;
    descriptionVia?: string | null;
}): string {
    let parsed: RawTransaction = {};
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
