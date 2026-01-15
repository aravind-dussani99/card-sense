import { categorizeWithGemini, categorizeWithOpenAI } from "./ai-category";
import { mapOpenBankingCategory, mapOpenBankingCategoryFromRecord } from "./open-banking-category";

type RawTx = Record<string, any>;

export async function resolveCategory(tx: RawTx): Promise<string> {
    const useOpenAI = Boolean(process.env.OPENAI_API_KEY);
    const ai = useOpenAI
        ? await categorizeWithOpenAI({
              merchant: tx.merchant_name || tx.merchant,
              description: tx.description || tx.descriptionVia,
              reference: tx.reference,
          })
        : await categorizeWithGemini({
              merchant: tx.merchant_name || tx.merchant,
              description: tx.description || tx.descriptionVia,
              reference: tx.reference,
          });
    if (ai) return ai;
    return mapOpenBankingCategory(tx);
}

export async function resolveCategoryFromRecord(record: {
    raw?: string | null;
    merchant?: string | null;
    descriptionVia?: string | null;
}): Promise<string> {
    let parsed: RawTx = {};
    if (record.raw) {
        try {
            parsed = JSON.parse(record.raw);
        } catch {
            parsed = {};
        }
    }
    if (!parsed.description && record.descriptionVia) parsed.description = record.descriptionVia;
    if (!parsed.merchant_name && record.merchant) parsed.merchant_name = record.merchant;
    const useOpenAI = Boolean(process.env.OPENAI_API_KEY);
    const ai = useOpenAI
        ? await categorizeWithOpenAI({
              merchant: parsed.merchant_name,
              description: parsed.description,
              reference: parsed.reference,
          })
        : await categorizeWithGemini({
              merchant: parsed.merchant_name,
              description: parsed.description,
              reference: parsed.reference,
          });
    if (ai) return ai;
    return mapOpenBankingCategoryFromRecord(record);
}
