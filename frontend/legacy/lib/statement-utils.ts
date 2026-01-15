/**
 * Statement Utility Functions
 * Non-server action utilities for statement detection
 */

export interface EmailAttachment {
    filename: string;
    mimeType: string;
}

/**
 * Detect if an email contains a bank statement
 * Only process attachments if "statement" keyword is present
 */
export function detectStatement(emailSubject: string, emailBody: string, attachments?: EmailAttachment[]): boolean {
    const subjectLower = emailSubject.toLowerCase();
    const bodyLower = emailBody.toLowerCase();
    
    // Check for statement keywords - REQUIRED for attachment processing
    const statementKeywords = [
        'statement',
        'account statement',
        'credit card statement',
        'monthly statement',
        'e-statement',
        'statement of account',
        'account summary'
    ];
    
    const hasStatementKeyword = statementKeywords.some(keyword => 
        subjectLower.includes(keyword) || bodyLower.includes(keyword)
    );
    
    // Only process attachments if statement keyword is found
    if (!hasStatementKeyword) {
        return false;
    }
    
    // Check for PDF attachments (common for statements)
    const hasPdfAttachment = attachments?.some(att => 
        att.filename.toLowerCase().endsWith('.pdf') || 
        att.mimeType === 'application/pdf' ||
        att.mimeType === 'application/x-pdf'
    );
    
    // Check for image attachments (some banks send statements as images)
    const hasImageAttachment = attachments?.some(att => 
        att.mimeType?.startsWith('image/')
    );
    
    // Return true if statement keyword is present
    // Also process if it's a statement email even without attachments (might be text-based statement)
    if (hasStatementKeyword) {
        // If has attachments, process them
        if (hasPdfAttachment || hasImageAttachment) {
            return true;
        }
        // If no attachments but has statement keyword, still process as statement (text-based)
        // This allows processing statement emails that contain transaction data in the body
        return true;
    }
    
    return false;
}

