"use server";

/**
 * LLM Service for analyzing emails and extracting transactions/offers
 * 
 * Supports: OpenAI, Anthropic Claude
 */

export interface ExtractedTransaction {
    merchant: string;
    amount: number;
    date: string; // ISO date string
    category?: string;
    subCategory?: string;
    description?: string;
    cardLast4?: string; // Card last 4 digits (if found, even if not in database)
    accountNumber?: string; // Bank account number (if found, even if masked like XX8586)
    customerId?: string; // Customer ID (if found)
    bankName?: string; // Bank name (if found)
    confidence: number; // 0-1 confidence score
}

export interface ExtractedOffer {
    title: string;
    description: string;
    discountAmount?: number;
    discountPercent?: number;
    minSpend?: number;
    maxDiscount?: number;
    startDate: string; // ISO date string
    endDate: string; // ISO date string
    terms?: string;
    category?: string;
    cardLast4?: string; // To match with card
    confidence: number; // 0-1 confidence score
}

export interface EmailAnalysisResult {
    transactions: ExtractedTransaction[];
    offers: ExtractedOffer[];
    isTransactionEmail: boolean;
    isOfferEmail: boolean;
}

/**
 * Analyze email using OpenAI
 */
async function analyzeWithOpenAI(
    emailSubject: string,
    emailBody: string,
    cards: Array<{ id: string; name: string; last4: string; bank: string }>
): Promise<EmailAnalysisResult> {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY not configured");
        }

        // Dynamic import - only if package is installed
        let OpenAI;
        try {
            const openaiModule = await import('openai');
            OpenAI = openaiModule.default || openaiModule;
        } catch (importError) {
            throw new Error("OpenAI package not installed. Run: npm install openai");
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const systemPrompt = `You are an intelligent financial email analyzer. Analyze the email content contextually to understand its purpose and extract relevant information.

Available cards/accounts (for reference only - extract transactions even if card/account is not in list): ${JSON.stringify(cards)}

ANALYSIS APPROACH:
- Read and understand the FULL email content (subject and body) contextually
- Do NOT rely on specific keywords like "debit", "credit", "statement", etc.
- Understand the INTENT and MEANING of the email
- Classify emails based on their actual content and purpose, not just keywords

TRANSACTION DETECTION:
- A transaction email contains information about money movement (payments, purchases, transfers, withdrawals, deposits, etc.)
- Look for: amounts, dates, merchant/vendor names, account/card references, transaction descriptions
- Extract ALL transactions found, regardless of whether the card/account exists in the database
- If card number or account number is mentioned but not in the available list, still extract it - it will be added later
- Include partial card numbers (last 4 digits), account numbers, or customer IDs if mentioned
- Extract bank name if mentioned

OFFER DETECTION:
- An offer email contains promotional information (discounts, cashback, rewards, special deals, etc.)
- Look for: discount percentages/amounts, validity dates, terms and conditions, promotional codes
- Extract all offers found, even if they don't mention specific cards

Return JSON with this exact structure:
{
    "transactions": [
        {
            "merchant": "string (vendor/merchant name or 'Unknown' if not clear)",
            "amount": number,
            "date": "YYYY-MM-DD (extract from email, use today's date if not found)",
            "category": "string (optional - infer from context)",
            "subCategory": "string (optional)",
            "description": "string (optional - full transaction description)",
            "cardLast4": "string (optional - last 4 digits if mentioned, even if not in available cards)",
            "accountNumber": "string (optional - account number or masked account like XX8586)",
            "customerId": "string (optional - customer ID if mentioned)",
            "bankName": "string (optional - bank name if mentioned)",
            "confidence": number (0-1)
        }
    ],
    "offers": [
        {
            "title": "string",
            "description": "string",
            "discountAmount": number (optional),
            "discountPercent": number (optional),
            "minSpend": number (optional),
            "maxDiscount": number (optional),
            "startDate": "YYYY-MM-DD (extract from email, use today if not found)",
            "endDate": "YYYY-MM-DD (extract from email, use 30 days from today if not found)",
            "terms": "string (optional)",
            "category": "string (optional)",
            "cardLast4": "string (optional)",
            "confidence": number (0-1)
        }
    ],
    "isTransactionEmail": boolean (true if email contains transaction information, false otherwise),
    "isOfferEmail": boolean (true if email contains offer/promotional information, false otherwise)
}`;

        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Subject: ${emailSubject}\n\nBody: ${emailBody}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error("No response from OpenAI");
        }

        const result = JSON.parse(content);
        return {
            transactions: result.transactions || [],
            offers: result.offers || [],
            isTransactionEmail: result.isTransactionEmail || false,
            isOfferEmail: result.isOfferEmail || false,
        };
    } catch (error: any) {
        console.error("OpenAI analysis error:", error);
        throw error;
    }
}

/**
 * Analyze email using Anthropic Claude
 */
async function analyzeWithAnthropic(
    emailSubject: string,
    emailBody: string,
    cards: Array<{ id: string; name: string; last4: string; bank: string }>
): Promise<EmailAnalysisResult> {
    try {
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error("ANTHROPIC_API_KEY not configured");
        }

        // Dynamic import - only if package is installed
        let Anthropic;
        try {
            const anthropicModule = await import('@anthropic-ai/sdk');
            Anthropic = anthropicModule.default || anthropicModule;
        } catch (importError) {
            throw new Error("Anthropic package not installed. Run: npm install @anthropic-ai/sdk");
        }

        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const systemPrompt = `You are an intelligent financial email analyzer. Analyze the email content contextually to understand its purpose and extract relevant information.

Available cards/accounts (for reference only - extract transactions even if card/account is not in list): ${JSON.stringify(cards, null, 2)}

ANALYSIS APPROACH:
- Read and understand the FULL email content (subject and body) contextually
- Do NOT rely on specific keywords like "debit", "credit", "statement", etc.
- Understand the INTENT and MEANING of the email
- Classify emails based on their actual content and purpose, not just keywords

TRANSACTION DETECTION:
- A transaction email contains information about money movement (payments, purchases, transfers, withdrawals, deposits, etc.)
- Look for: amounts, dates, merchant/vendor names, account/card references, transaction descriptions
- Extract ALL transactions found, regardless of whether the card/account exists in the database
- If card number or account number is mentioned but not in the available list, still extract it - it will be added later
- Include partial card numbers (last 4 digits), account numbers, or customer IDs if mentioned
- Extract bank name if mentioned

OFFER DETECTION:
- An offer email contains promotional information (discounts, cashback, rewards, special deals, etc.)
- Look for: discount percentages/amounts, validity dates, terms and conditions, promotional codes
- Extract all offers found, even if they don't mention specific cards

Return JSON with this exact structure:
{
    "transactions": [{"merchant": "string (vendor/merchant name or 'Unknown' if not clear)", "amount": number, "date": "YYYY-MM-DD (extract from email, use today's date if not found)", "category": "string (optional - infer from context)", "subCategory": "string (optional)", "description": "string (optional - full transaction description)", "cardLast4": "string (optional - last 4 digits if mentioned, even if not in available cards)", "accountNumber": "string (optional - account number or masked account like XX8586)", "customerId": "string (optional - customer ID if mentioned)", "bankName": "string (optional - bank name if mentioned)", "confidence": number (0-1)}],
    "offers": [{"title": "string", "description": "string", "discountAmount": number (optional), "discountPercent": number (optional), "minSpend": number (optional), "maxDiscount": number (optional), "startDate": "YYYY-MM-DD (extract from email, use today if not found)", "endDate": "YYYY-MM-DD (extract from email, use 30 days from today if not found)", "terms": "string (optional)", "category": "string (optional)", "cardLast4": "string (optional)", "confidence": number (0-1)}],
    "isTransactionEmail": boolean (true if email contains transaction information, false otherwise),
    "isOfferEmail": boolean (true if email contains offer/promotional information, false otherwise)
}

Extract transactions/offers with confidence > 0.5. Be accurate with dates and amounts.`;

        const message = await anthropic.messages.create({
            model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
                {
                    role: "user",
                    content: `Subject: ${emailSubject}\n\nBody: ${emailBody.substring(0, 8000)}`
                }
            ],
        });

        const content = message.content[0];
        if (content.type === 'text') {
            const result = JSON.parse(content.text);
            // Filter by confidence
            const transactions = (result.transactions || []).filter((t: any) => t.confidence > 0.7);
            const offers = (result.offers || []).filter((o: any) => o.confidence > 0.7);
            
            return {
                transactions,
                offers,
                isTransactionEmail: result.isTransactionEmail || false,
                isOfferEmail: result.isOfferEmail || false,
            };
        }

        throw new Error("Unexpected response format from Anthropic");
    } catch (error: any) {
        console.error("Anthropic analysis error:", error);
        throw error;
    }
}

/**
 * Main analyze function - automatically selects provider
 */
export async function analyzeEmail(
    emailSubject: string,
    emailBody: string,
    existingTransactions: string[], // Array of processed email IDs
    cards: Array<{ id: string; name: string; last4: string; bank: string }>
): Promise<EmailAnalysisResult> {
    try {
        // Try OpenAI first if configured
        if (process.env.OPENAI_API_KEY) {
            return await analyzeWithOpenAI(emailSubject, emailBody, cards);
        }
        
        // Try Anthropic if configured
        if (process.env.ANTHROPIC_API_KEY) {
            return await analyzeWithAnthropic(emailSubject, emailBody, cards);
        }
        
        // No LLM configured
        console.warn("No LLM API key configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY");
        return {
            transactions: [],
            offers: [],
            isTransactionEmail: false,
            isOfferEmail: false,
        };
    } catch (error: any) {
        console.error("Error analyzing email:", error);
        return {
            transactions: [],
            offers: [],
            isTransactionEmail: false,
            isOfferEmail: false,
        };
    }
}

/**
 * Match extracted transaction to a card based on card details
 * Returns card ID if matched, null if not found (transaction will still be created as draft)
 */
export async function matchTransactionToCard(
    transaction: ExtractedTransaction,
    cards: Array<{ id: string; last4: string; bank: string }>
): Promise<string | null> {
    // Try to match by card last4
    if (transaction.cardLast4) {
        const matchedCard = cards.find(card => card.last4 === transaction.cardLast4);
        if (matchedCard) {
            return matchedCard.id;
        }
    }
    // No match found - return null (transaction will still be created as draft)
    return null;
}
