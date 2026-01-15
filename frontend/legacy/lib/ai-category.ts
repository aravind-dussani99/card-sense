const ALLOWED_CATEGORIES = [
    "AI Tools",
    "Fuel",
    "Groceries",
    "Dining",
    "Travel",
    "Shopping",
    "Bills",
    "Banking Fees",
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

const DEFAULT_GEMINI_MODELS = [
    process.env.GEMINI_MODEL,
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro-latest",
    "gemini-pro",
].filter(Boolean) as string[];
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const OPENAI_API_BASE = "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function extractCategory(text: string) {
    const normalized = text.trim();
    const match = ALLOWED_CATEGORIES.find((cat) => cat.toLowerCase() === normalized.toLowerCase());
    return match || null;
}

export async function categorizeWithGemini(input: {
    merchant?: string | null;
    description?: string | null;
    reference?: string | null;
}): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) return null;

    const text = [input.merchant, input.description, input.reference].filter(Boolean).join(" · ").trim();
    if (!text) return null;

    const prompt = `Classify the transaction into ONE category from this list only:
${ALLOWED_CATEGORIES.join(", ")}

Guidance:
- Prefer the most specific category over generic "Shopping" or "Other".
- Subscriptions: recurring services (e.g., Netflix, Spotify, Adobe, OpenAI, Cursor, GitHub, AWS).
- AI Tools: AI/LLM products or developer AI tools (e.g., OpenAI, Anthropic, Cursor).
- Entertainment: movies, cinemas, streaming, events (e.g., Netflix, Disney, Hollywood Bowl).
- Fitness: gyms, fitness apps (e.g., PureGym).
- Groceries: supermarkets and grocery stores.
- Dining: restaurants, cafes, fast food (e.g., Burger King).
- Banking Fees: overdraft, interest, bank fees.
- Transfers: person-to-person or bank transfers.

Transaction text: "${text}"

Return ONLY the category name, nothing else.`;

    for (const model of DEFAULT_GEMINI_MODELS) {
        const response = await fetch(
            `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: prompt }],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 16,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text().catch(() => "");
            console.warn("Gemini category error:", response.status, response.statusText, errText);
            if (response.status === 404) continue;
            return null;
        }

        const data = await response.json();
        const textOut =
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.text ||
            "";
        const extracted = extractCategory(String(textOut));
        if (!extracted) {
            console.warn("Gemini category unparsable response:", textOut);
        }
        return extracted;
    }

    return null;
}

export { ALLOWED_CATEGORIES };

export async function categorizeWithOpenAI(input: {
    merchant?: string | null;
    description?: string | null;
    reference?: string | null;
}): Promise<string | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const text = [input.merchant, input.description, input.reference].filter(Boolean).join(" · ").trim();
    if (!text) return null;

    const prompt = `Classify the transaction into ONE category from this list only:
${ALLOWED_CATEGORIES.join(", ")}

Guidance:
- Prefer the most specific category over generic "Shopping" or "Other".
- Subscriptions: recurring services (e.g., Netflix, Spotify, Adobe, OpenAI, Cursor, GitHub, AWS).
- AI Tools: AI/LLM products or developer AI tools (e.g., OpenAI, Anthropic, Cursor).
- Entertainment: movies, cinemas, streaming, events (e.g., Netflix, Disney, Hollywood Bowl).
- Fitness: gyms, fitness apps (e.g., PureGym).
- Groceries: supermarkets and grocery stores.
- Dining: restaurants, cafes, fast food (e.g., Burger King).
- Banking Fees: overdraft, interest, bank fees.
- Transfers: person-to-person or bank transfers.

Transaction text: "${text}"

Return ONLY the category name, nothing else.`;

    const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            temperature: 0.2,
            max_tokens: 16,
            messages: [
                { role: "system", content: "You classify bank transactions into a fixed category list." },
                { role: "user", content: prompt },
            ],
        }),
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.warn("OpenAI category error:", response.status, response.statusText, errText);
        return null;
    }

    const data = await response.json();
    const textOut = data?.choices?.[0]?.message?.content || "";
    const extracted = extractCategory(String(textOut));
    if (!extracted) {
        console.warn("OpenAI category unparsable response:", textOut);
    }
    return extracted;
}
