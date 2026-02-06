export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    pageSize: number;
  };
};

export type Bank = {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
};

export type BankConnection = {
  id: string;
  provider: string;
  institutionId?: string | null;
  status?: string | null;
  userId?: string | null;
  createdAt?: string;
  daysLeft?: number;
};

export type BankAccount = {
  id: string;
  name?: string | null;
  type?: string | null;
  mask?: string | null;
  accountNumber?: string | null;
  sortCode?: string | null;
  currency?: string | null;
  balance?: number | null;
  availableBalance?: number | null;
  limit?: number | null;
  statementBalance?: number | null;
  statementDate?: string | null;
  statementDueDate?: string | null;
  statementPaidAmount?: number | null;
  statementPaidComputed?: number | null;
  statementPayable?: number | null;
  statementDueInDays?: number | null;
  connectionId?: string | null;
  providerAccountId?: string | null;
  status?: string | null;
  tags?: string | null;
};

export type CardType = {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
};

export type HeadAccount = {
  id: string;
  name: string;
};

export type Card = {
  id: string;
  name: string;
  last4?: string | null;
  cardTypeId?: string | null;
  bankId?: string | null;
  bank?: string | null;
  balance?: number | null;
  limit?: number | null;
  cutoffDate?: number | null;
  dueDate?: number | null;
  color?: string | null;
};

export type Category = {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  subCategories?: SubCategory[];
};

export type SubCategory = {
  id: string;
  name: string;
  categoryId?: string | null;
};

export type BankTransactionMeta = {
  id: string;
  bankTransactionId: string;
  openingBalance?: number | null;
  closingBalance?: number | null;
  fromEntity?: string | null;
  viaEntity?: string | null;
  toEntity?: string | null;
  headAccount?: string | null;
  subCategory?: string | null;
  remarks?: string | null;
  attachmentsJson?: string | null;
  comments?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type BankTransaction = {
  id: string;
  accountId?: string | null;
  account?: BankAccount | null;
  amount: number;
  currency?: string | null;
  date: string;
  merchant?: string | null;
  descriptionVia?: string | null;
  direction?: string | null;
  category?: string | null;
  subCategory?: string | null;
  runningBalance?: number | null;
  pending?: boolean | null;
  providerTransactionId?: string | null;
  transactionType?: string | null;
  meta?: BankTransactionMeta | null;
};

export type SecureRecordType = "BANK_ACCOUNT" | "OVERDRAFT" | "CREDIT_CARD" | "DEBIT_CARD" | "OTHER";

export type SecureVaultRecord = {
  id: string;
  recordType: SecureRecordType;
  label: string;
  bankName?: string | null;
  accountNumber?: string | null;
  sortCode?: string | null;
  cardLast4?: string | null;
  username?: string | null;
  status?: string | null;
  encryptedPayload: string;
  createdAt?: string;
  updatedAt?: string;
};

export type UserAccount = {
  id: string;
  label: string;
  bankName?: string | null;
  accountType?: string | null;
  accountNumber?: string | null;
  sortCode?: string | null;
  currency?: string | null;
  balance?: number | null;
  limit?: number | null;
  status?: string | null;
  linkedBankAccountId?: string | null;
  secureRecordId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type UserCard = {
  id: string;
  cardType?: string | null;
  label: string;
  issuerBankName?: string | null;
  network?: string | null;
  last4?: string | null;
  statementDay?: number | null;
  dueDay?: number | null;
  last3StatementDates?: string | null;
  last3DueDates?: string | null;
  status?: string | null;
  imageUrl?: string | null;
  linkedBankAccountId?: string | null;
  secureRecordId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type UserAccountCard = {
  id: string;
  userAccountId: string;
  userCardId: string;
  relationType?: string | null;
  createdAt?: string;
};

export type AnalyticsValuePoint = {
  name: string;
  value: number;
};

export type AnalyticsMonthlyPoint = {
  month: string;
  total: number;
};
