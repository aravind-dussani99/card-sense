"use server";

import { prisma } from "@/lib/prisma";
import { getCards } from "@/app/actions/card-actions";
import { detectStatement } from './statement-utils';
export { detectStatement };

/**
 * Bank Statement Processing Service
 * Handles detection, extraction, and reconciliation of bank statements
 */

export interface StatementTransaction {
    date: Date;
    description: string;
    amount: number;
    type: "debit" | "credit";
    reference?: string;
    balance?: number;
}

export interface StatementData {
    cardId?: string;
    cardLast4?: string;
    accountNumber?: string;
    customerId?: string;
    bankName?: string;
    statementPeriod: {
        start: Date;
        end: Date;
    };
    transactions: StatementTransaction[];
    offers?: Array<{
        title: string;
        description: string;
        validUntil?: Date;
    }>;
}

/**
 * Parse PDF and extract text content
 * Server-friendly: uses pdfjs-dist with workers disabled (no external worker chunk)
 */
async function parsePDF(pdfBuffer: Buffer, password?: string): Promise<string> {
    try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(pdfBuffer),
            password: password || '',
            disableWorker: true,
            stopAtErrors: false,
            useSystemFonts: true,
            isEvalSupported: false,
            disableFontFace: true,
        });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
        }
        if (fullText.trim()) {
            return fullText.trim();
        }
        throw new Error('No text extracted from PDF');
    } catch (error: any) {
        if (error.message?.toLowerCase().includes('password')) {
            throw new Error('PDF is password protected. Please provide the password.');
        }
        console.error('PDF parsing error (pdfjs-dist):', error);
        throw new Error(`Failed to parse PDF: ${error.message || 'Unknown error'}`);
    }
}

/**
 * Parse Excel file and extract text content
 */
async function parseExcel(excelBuffer: Buffer): Promise<string> {
    try {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(excelBuffer, { type: 'buffer' });
        let textContent = '';
        
        // Extract text from all sheets
        workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            textContent += '\n' + jsonData.map((row: any) => Array.isArray(row) ? row.join(' | ') : String(row)).join('\n');
        });
        
        return textContent.trim();
    } catch (error: any) {
        console.error('Excel parsing error:', error);
        throw new Error(`Failed to parse Excel file: ${error.message || 'Unknown error'}`);
    }
}

/**
 * Parse CSV file and extract text content
 */
async function parseCSV(csvBuffer: Buffer): Promise<string> {
    try {
        const { parse } = await import('csv-parse/sync');
        const records = parse(csvBuffer.toString('utf-8'), {
            columns: true,
            skip_empty_lines: true,
        });
        
        // Convert to readable text format
        const textContent = records.map((record: any) => 
            Object.values(record).join(' | ')
        ).join('\n');
        
        return textContent;
    } catch (error: any) {
        console.error('CSV parsing error:', error);
        throw new Error(`Failed to parse CSV file: ${error.message || 'Unknown error'}`);
    }
}

/**
 * Extract text from image using OCR
 */
async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
    try {
        const { createWorker } = await import('tesseract.js');
        
        const worker = await createWorker('eng');
        const { data: { text } } = await worker.recognize(imageBuffer);
        await worker.terminate();
        
        return text;
    } catch (error: any) {
        throw new Error(`Failed to extract text from image: ${error.message}`);
    }
}

/**
 * Extract statement data from email/attachment using LLM
 */
export async function extractStatementWithLLM(
    textContent: string,
    emailSubject: string,
    cards: Array<{ id: string; name: string; last4: string; bank: string }>
): Promise<StatementData | null> {
    try {
        // Always try LLM first if API key is available (better accuracy)
        const useLLM = process.env.USE_LLM_FOR_STATEMENTS !== 'false';
        if (useLLM && process.env.OPENAI_API_KEY) {
            try {
                console.log('[Statement Parser] Using LLM for statement extraction');
                const result = await extractStatementWithOpenAI(textContent, emailSubject, cards);
                if (result && result.transactions.length > 0) {
                    console.log(`[Statement Parser] LLM extracted ${result.transactions.length} transactions`);
                    return result;
                }
                console.warn('[Statement Parser] LLM returned no transactions, falling back to regex');
            } catch (error: any) {
                console.error("LLM extraction failed, falling back to regex:", error.message);
            }
        }
        
        // Fallback to regex extraction
        console.log('[Statement Parser] Using regex for statement extraction');
        return extractStatementWithRegex(textContent, emailSubject, cards);
    } catch (error: any) {
        console.error("Error extracting statement with LLM:", error);
        // Fallback to regex extraction
        return extractStatementWithRegex(textContent, emailSubject, cards);
    }
}

/**
 * Extract statement data using OpenAI
 */
async function extractStatementWithOpenAI(
    textContent: string,
    emailSubject: string,
    cards: Array<{ id: string; name: string; last4: string; bank: string }>
): Promise<StatementData | null> {
    try {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const systemPrompt = `You are an expert bank statement parser. Extract structured data from bank statement text, PDFs, Excel files, CSV files, or any other format.

Available cards: ${JSON.stringify(cards.map(c => ({ name: c.name, last4: c.last4, bank: c.bank })))}

The statement content may be from:
- PDF text extraction
- Excel/CSV file content
- Image OCR text
- Plain text email body

Return a JSON object with this exact structure:
{
    "cardLast4": "string (last 4 digits of card, if found. Extract from patterns like 'Card ending in 1234', 'Card **1234', 'Card No. XXXX1234')",
    "accountNumber": "string (account number if found, extract from patterns like 'A/c no. XX8586', 'Account XX8586')",
    "customerId": "string (customer ID if found)",
    "bankName": "string (name of bank, extract from email sender or statement header)",
    "statementPeriod": {
        "start": "YYYY-MM-DD (statement period start date)",
        "end": "YYYY-MM-DD (statement period end date)"
    },
    "transactions": [
        {
            "date": "YYYY-MM-DD (transaction date)",
            "description": "string (merchant/transaction description)",
            "amount": number (absolute amount, always positive),
            "type": "debit" or "credit" (debit = money out, credit = money in),
            "reference": "string (optional transaction reference)",
            "balance": number (optional account balance after transaction)
        }
    ],
    "offers": [
        {
            "title": "string",
            "description": "string",
            "validUntil": "YYYY-MM-DD (optional)"
        }
    ]
}

Important:
- Extract ALL transactions from the statement, even if the format is unusual
- Handle various date formats (DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, etc.)
- Extract card/account numbers even if partially masked (XX8586, **1234, etc.)
- Amounts should always be positive numbers
- Match transactions to cards by last 4 digits if available
- If no card matches, still extract all transactions (they'll be suggested for card creation)`;

        // Use gpt-4o for better extraction, fallback to gpt-4o-mini or gpt-4-turbo
        const model = process.env.OPENAI_MODEL || "gpt-4o";
        
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Extract statement data from:\n\nSubject: ${emailSubject}\n\nContent:\n${textContent.substring(0, 100000)}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
        });

        const result = JSON.parse(response.choices[0].message.content || '{}');
        
        // Convert to StatementData format
        const statementData: StatementData = {
            cardLast4: result.cardLast4 || result.cardNumber?.slice(-4) || undefined,
            accountNumber: result.accountNumber,
            customerId: result.customerId,
            bankName: result.bankName,
            statementPeriod: {
                start: new Date(result.statementPeriod?.start || new Date()),
                end: new Date(result.statementPeriod?.end || new Date()),
            },
            transactions: (result.transactions || []).map((tx: any) => ({
                date: new Date(tx.date),
                description: tx.description || tx.merchant || tx.narration || '',
                amount: Math.abs(parseFloat(tx.amount) || 0), // Always positive
                type: tx.type === "credit" ? "credit" : "debit",
                reference: tx.reference || tx.refNo || tx.transactionId,
                balance: tx.balance ? parseFloat(tx.balance) : undefined,
            })),
            offers: result.offers || [],
        };

        // Match to card
        if (statementData.cardLast4) {
            const card = cards.find(c => c.last4 === statementData.cardLast4);
            if (card) {
                statementData.cardId = card.id;
            }
        }

        return statementData;
    } catch (error: any) {
        console.error("Error extracting statement with OpenAI:", error);
        throw error;
    }
}

/**
 * Extract statement data using regex patterns (fallback method)
 */
function extractStatementWithRegex(
    textContent: string,
    emailSubject: string,
    cards: Array<{ id: string; name: string; last4: string; bank: string }>
): StatementData | null {
    try {
        // Extract card number (last 4 digits)
        const cardMatch = textContent.match(/(?:card|account)[\s:]*[*\s]*(\d{4})/i);
        const cardLast4 = cardMatch ? cardMatch[1] : undefined;
        
        // Find matching card
        const card = cardLast4 ? cards.find(c => c.last4 === cardLast4) : undefined;
        
        // Extract statement period
        const datePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g;
        const dates: Date[] = [];
        let match;
        while ((match = datePattern.exec(textContent)) !== null) {
            const year = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
            const month = parseInt(match[1]) - 1;
            const day = parseInt(match[2]);
            dates.push(new Date(year, month, day));
        }
        
        const statementStart = dates.length > 0 ? dates[0] : new Date();
        const statementEnd = dates.length > 1 ? dates[dates.length - 1] : new Date();
        
        // Extract transactions
        const transactions: StatementTransaction[] = [];
        
        // Common patterns for transaction lines
        const transactionPatterns = [
            // Pattern: Date Description Amount
            /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([\d,]+\.?\d*)/g,
            // Pattern: Date Amount Description
            /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+([\d,]+\.?\d*)\s+(.+?)(?:\n|$)/g,
        ];
        
        for (const pattern of transactionPatterns) {
            let txMatch;
            while ((txMatch = pattern.exec(textContent)) !== null && transactions.length < 1000) {
                try {
                    const dateStr = txMatch[1];
                    const [day, month, year] = dateStr.split(/[\/\-]/);
                    const txDate = new Date(
                        year.length === 2 ? 2000 + parseInt(year) : parseInt(year),
                        parseInt(month) - 1,
                        parseInt(day)
                    );
                    
                    const amountStr = txMatch[2] || txMatch[3];
                    const amount = parseFloat(amountStr.replace(/,/g, ''));
                    const description = txMatch[3] || txMatch[2] || '';
                    
                    if (!isNaN(amount) && !isNaN(txDate.getTime())) {
                        transactions.push({
                            date: txDate,
                            description: description.trim(),
                            amount: Math.abs(amount),
                            type: amount < 0 ? "debit" : "credit",
                        });
                    }
                } catch (e) {
                    // Skip invalid transactions
                }
            }
        }
        
        // Extract bank name
        const bankPattern = /(?:bank|issuer)[\s:]+([A-Z][A-Za-z\s]+)/i;
        const bankMatch = textContent.match(bankPattern);
        const bankName = bankMatch ? bankMatch[1].trim() : (card?.bank || undefined);
        
        return {
            cardId: card?.id,
            cardLast4: cardLast4 || card?.last4,
            bankName,
            statementPeriod: {
                start: statementStart,
                end: statementEnd,
            },
            transactions: transactions.slice(0, 1000), // Limit to 1000 transactions
        };
    } catch (error) {
        console.error("Error extracting statement with regex:", error);
        return null;
    }
}

/**
 * Extract statement data from email/attachment
 */
export async function extractStatementData(
    emailSubject: string,
    emailBody: string,
    attachments?: Array<{ filename: string; mimeType: string; content?: Buffer; attachmentId?: string }>,
    password?: string,
    messageId?: string,
    provider?: "gmail" | "outlook",
    options?: { forceProcessAttachments?: boolean }
): Promise<StatementData | null> {
    try {
        const cards = await getCards();
        let textContent = emailBody || '';
        
        // Process attachments ONLY if this is a statement email
        // Check if email is a statement email before processing attachments
        const isStatementEmail = options?.forceProcessAttachments 
            ? true 
            : detectStatement(emailSubject, emailBody, attachments);
        
        if (isStatementEmail && attachments && attachments.length > 0) {
            for (const attachment of attachments) {
                let attachmentContent: Buffer | undefined;
                
                // Get attachment content
                if (attachment.content) {
                    // Outlook - content is already available
                    attachmentContent = attachment.content;
                } else if (attachment.attachmentId && messageId && provider) {
                    // Gmail - need to fetch attachment
                    try {
                        const { getAttachment } = await import('./email-service');
                        attachmentContent = await getAttachment(messageId, attachment.attachmentId, provider);
                    } catch (error) {
                        console.error("Failed to fetch attachment:", error);
                        continue;
                    }
                }
                
                if (!attachmentContent) continue;
                
                // Process PDF
                if (attachment.mimeType === 'application/pdf' || 
                    attachment.mimeType === 'application/x-pdf' ||
                    attachment.filename.toLowerCase().endsWith('.pdf')) {
                    try {
                        const pdfText = await parsePDF(attachmentContent, password);
                        if (pdfText && pdfText.trim().length > 0) {
                            textContent += '\n\n' + pdfText;
                        }
                    } catch (error: any) {
                        if (error.message?.includes('password')) {
                            throw error; // Re-throw password errors
                        }
                        // Log error but continue processing - don't crash entire email processing
                        console.error("Failed to parse PDF attachment:", attachment.filename, error.message);
                        // Continue with email body text if PDF parsing fails
                    }
                }
                // Process Excel files
                else if (attachment.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                         attachment.mimeType === 'application/vnd.ms-excel' ||
                         attachment.filename.toLowerCase().endsWith('.xlsx') ||
                         attachment.filename.toLowerCase().endsWith('.xls')) {
                    try {
                        const excelText = await parseExcel(attachmentContent);
                        if (excelText && excelText.trim().length > 0) {
                            textContent += '\n\n' + excelText;
                        }
                    } catch (error: any) {
                        console.error("Failed to parse Excel attachment:", attachment.filename, error.message);
                    }
                }
                // Process CSV files
                else if (attachment.mimeType === 'text/csv' ||
                         attachment.filename.toLowerCase().endsWith('.csv')) {
                    try {
                        const csvText = await parseCSV(attachmentContent);
                        if (csvText && csvText.trim().length > 0) {
                            textContent += '\n\n' + csvText;
                        }
                    } catch (error: any) {
                        console.error("Failed to parse CSV attachment:", attachment.filename, error.message);
                    }
                }
                // Process images
                else if (attachment.mimeType?.startsWith('image/')) {
                    try {
                        const imageText = await extractTextFromImage(attachmentContent);
                        textContent += '\n\n' + imageText;
                    } catch (error) {
                        console.error("Failed to extract text from image:", error);
                    }
                }
            }
        }
        
        // Extract structured data
        if (textContent.trim().length > 0) {
            return await extractStatementWithLLM(textContent, emailSubject, cards);
        }
        
        return null;
    } catch (error: any) {
        console.error("Error extracting statement data:", error);
        throw error;
    }
}

/**
 * Reconcile statement transactions with existing transactions
 */
export async function reconcileStatement(
    statementData: StatementData,
    existingTransactions: Array<{
        id: string;
        date: Date;
        amount: number;
        merchant: string;
        description?: string;
    }>
): Promise<{
    matched: Array<{ statement: StatementTransaction; existing: string }>;
    unmatched: StatementTransaction[];
    missing: Array<{ id: string; date: Date; amount: number; merchant: string }>;
}> {
    const matched: Array<{ statement: StatementTransaction; existing: string }> = [];
    const unmatched: StatementTransaction[] = [];
    const missing: Array<{ id: string; date: Date; amount: number; merchant: string }> = [];
    
    // Match transactions by date and amount (within tolerance)
    const tolerance = 0.01; // $0.01 tolerance for floating point differences
    
    for (const stmtTx of statementData.transactions) {
        const match = existingTransactions.find(existing => {
            const dateDiff = Math.abs(
                new Date(existing.date).getTime() - new Date(stmtTx.date).getTime()
            );
            const amountDiff = Math.abs(existing.amount - Math.abs(stmtTx.amount));
            
            // Match if same date (within 1 day) and same amount (within tolerance)
            return dateDiff <= 24 * 60 * 60 * 1000 && amountDiff <= tolerance;
        });
        
        if (match) {
            matched.push({ statement: stmtTx, existing: match.id });
        } else {
            unmatched.push(stmtTx);
        }
    }
    
    // Find transactions in database that are missing from statement
    // (transactions that should be in the statement period but aren't)
    const statementStart = statementData.statementPeriod.start;
    const statementEnd = statementData.statementPeriod.end;
    
    for (const existing of existingTransactions) {
        const txDate = new Date(existing.date);
        if (txDate >= statementStart && txDate <= statementEnd) {
            const foundInStatement = statementData.transactions.some(stmtTx => {
                const dateDiff = Math.abs(
                    new Date(stmtTx.date).getTime() - txDate.getTime()
                );
                const amountDiff = Math.abs(Math.abs(stmtTx.amount) - existing.amount);
                return dateDiff <= 24 * 60 * 60 * 1000 && amountDiff <= tolerance;
            });
            
            if (!foundInStatement) {
                missing.push(existing);
            }
        }
    }
    
    return { matched, unmatched, missing };
}
