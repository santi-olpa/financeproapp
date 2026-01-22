// Finance Pro - Type Definitions

export type Currency = 'ARS' | 'USD';
export type AccountType = 'bank' | 'wallet' | 'cash' | 'investment' | 'crypto';
export type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment';
export type CategoryType = 'income' | 'expense';
export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  default_currency: Currency;
  hide_amounts: boolean;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  account_type: AccountType;
  currency: Currency;
  initial_balance: number;
  current_balance: number;
  alias: string | null;
  cbu_cvu: string | null;
  icon: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  category_type: CategoryType;
  icon: string;
  color: string;
  parent_id: string | null;
  is_system: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  transaction_type: TransactionType;
  amount: number;
  currency: Currency;
  description: string | null;
  transaction_date: string;
  account_id: string | null;
  category_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  has_installments: boolean;
  total_installments: number | null;
  current_installment: number | null;
  parent_transaction_id: string | null;
  recurring_expense_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  account?: Account;
  category?: Category;
  source_account?: Account;
  destination_account?: Account;
}

export interface Installment {
  id: string;
  user_id: string;
  transaction_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  is_paid: boolean;
  paid_date: string | null;
  created_at: string;
}

export interface PriceHistoryEntry {
  amount: number;
  effective_date: string;
  notes?: string;
}

export interface RecurringExpense {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: Currency;
  category_id: string | null;
  account_id: string | null;
  frequency: RecurringFrequency;
  start_date: string;
  next_due_date: string;
  end_date: string | null;
  is_active: boolean;
  last_generated_date: string | null;
  price_history: PriceHistoryEntry[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  category?: Category;
  account?: Account;
}

export interface MonthlySnapshot {
  id: string;
  user_id: string;
  period_month: number;
  period_year: number;
  total_income_ars: number;
  total_income_usd: number;
  total_expense_ars: number;
  total_expense_usd: number;
  net_balance_ars: number;
  net_balance_usd: number;
  created_at: string;
}

// UI Types
export interface FinanceSummary {
  totalIncomeARS: number;
  totalIncomeUSD: number;
  totalExpenseARS: number;
  totalExpenseUSD: number;
  netBalanceARS: number;
  netBalanceUSD: number;
  totalPatrimonioARS: number;
  totalPatrimonioUSD: number;
}

export interface AccountTypeInfo {
  type: AccountType;
  label: string;
  icon: string;
  description: string;
}

export const ACCOUNT_TYPES: AccountTypeInfo[] = [
  { type: 'bank', label: 'Cuenta Bancaria', icon: 'building-2', description: 'Caja de ahorro, cuenta corriente' },
  { type: 'wallet', label: 'Billetera Virtual', icon: 'smartphone', description: 'Mercado Pago, Ualá, etc.' },
  { type: 'cash', label: 'Efectivo', icon: 'banknote', description: 'Dinero en físico' },
  { type: 'investment', label: 'Inversiones', icon: 'trending-up', description: 'FCI, bonos, acciones' },
  { type: 'crypto', label: 'Crypto', icon: 'bitcoin', description: 'Bitcoin, ETH, USDT, etc.' },
];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  ARS: '$',
  USD: 'US$',
};

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

export const FREQUENCY_DAYS: Record<RecurringFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};
