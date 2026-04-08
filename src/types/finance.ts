// Finance Pro - Type Definitions
// Sincronizado con docs/02-data-model.md (Fase 1)

export type Currency = 'ARS' | 'USD';
export type AccountType = 'bank' | 'wallet' | 'cash' | 'credit_card' | 'savings' | 'investment' | 'crypto';
export type AccountSubtype = 'operating' | 'reserve' | 'liability' | 'investment';
export type TransactionType = 'income' | 'expense' | 'transfer' | 'card_payment' | 'adjustment';
export type CategoryType = 'income' | 'expense';
export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'yearly';
export type InstallmentStatus = 'pending' | 'billed' | 'paid' | 'cancelled';
export type GoalType = 'savings' | 'habit';
export type ExchangeRateType = 'oficial' | 'tarjeta' | 'mep' | 'blue';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  default_currency: Currency;
  hide_amounts: boolean;
  onboarding_completed: boolean;
  primary_kpi: 'runway' | 'savings_rate' | 'net_worth';
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  account_type: AccountType;
  account_subtype: AccountSubtype;
  currency: Currency;
  initial_balance: number;
  current_balance: number;
  alias: string | null;
  cbu_cvu: string | null;
  icon: string;
  color: string;
  is_active: boolean;
  // Solo para credit_card
  closing_day: number | null;
  due_day: number | null;
  credit_limit: number | null;
  default_payment_account_id: string | null;
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
  is_essential: boolean;
  display_order: number;
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
  recurring_expense_id: string | null;
  installment_id: string | null;
  card_statement_id: string | null;
  is_verified: boolean;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  account?: Account;
  category?: Category;
  source_account?: Account;
  destination_account?: Account;
}

export interface Purchase {
  id: string;
  user_id: string;
  card_account_id: string;
  category_id: string | null;
  merchant: string | null;
  description: string;
  purchase_date: string;
  total_amount: number;
  original_currency: Currency;
  installments_count: number;
  interest_rate: number;
  card_dollar_rate_override: number | null;
  notes: string | null;
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
  // Joined relations
  card_account?: Account;
  category?: Category;
  installments?: Installment[];
}

export interface Installment {
  id: string;
  user_id: string;
  purchase_id: string;
  installment_number: number;
  amount_original: number;
  amount_ars: number | null;
  billing_year: number;
  billing_month: number;
  status: InstallmentStatus;
  paid_transaction_id: string | null;
  created_at: string;
  // Joined relations
  purchase?: Purchase;
}

export interface CardStatement {
  id: string;
  user_id: string;
  card_account_id: string;
  period_year: number;
  period_month: number;
  closing_date: string;
  due_date: string;
  total_ars: number;
  card_dollar_rate: number | null;
  is_estimated: boolean;
  is_paid: boolean;
  paid_transaction_id: string | null;
  created_at: string;
  updated_at: string;
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

export interface FinancialGoal {
  id: string;
  user_id: string;
  goal_type: GoalType;
  name: string;
  description: string | null;
  target_amount: number | null;
  target_date: string | null;
  current_amount: number | null;
  linked_account_id: string | null;
  habit_percentage: number | null;
  habit_period: 'weekly' | 'monthly' | 'yearly' | null;
  currency: Currency;
  is_active: boolean;
  achieved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyBudget {
  id: string;
  user_id: string;
  category_id: string;
  year: number;
  month: number;
  amount: number;
  currency: Currency;
  created_at: string;
}

export interface ExchangeRate {
  id: string;
  rate_date: string;
  rate_type: ExchangeRateType;
  ars_per_usd: number;
  source: string;
  created_at: string;
}

// Resultado de v_monthly_summary
export interface MonthlySummary {
  total_income: number;
  total_expense_cash: number;
  total_expense_accrued: number;
  net_cash: number;
  net_accrued: number;
  savings_rate: number;
  essential_expense: number;
  discretionary_expense: number;
  cards_committed: number;
  recurring_committed: number;
  unique_categories: number;
}

// Resultado de v_projected_cashflow
export interface ProjectedCashflow {
  period_year: number;
  period_month: number;
  expected_income: number;
  recurring_expense: number;
  card_installments: number;
  total_committed: number;
  net_projected: number;
  cumulative_balance: number;
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
  { type: 'credit_card', label: 'Tarjeta de Crédito', icon: 'credit-card', description: 'Visa, Mastercard, Amex' },
  { type: 'savings', label: 'Cuenta de Ahorro', icon: 'piggy-bank', description: 'Ahorro separado, no operativo' },
  { type: 'investment', label: 'Inversiones', icon: 'trending-up', description: 'FCI, bonos, acciones' },
  { type: 'crypto', label: 'Crypto', icon: 'bitcoin', description: 'Bitcoin, ETH, USDT, etc.' },
];

export const ACCOUNT_SUBTYPE_LABELS: Record<AccountSubtype, string> = {
  operating: 'Operativa (liquidez)',
  reserve: 'Ahorro / Reserva',
  liability: 'Deuda (tarjeta)',
  investment: 'Inversión',
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  ARS: '$',
  USD: 'US$',
};

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  yearly: 'Anual',
};

export const FREQUENCY_DAYS: Record<RecurringFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  bimonthly: 60,
  quarterly: 90,
  semiannual: 180,
  yearly: 365,
};

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  pending: 'Pendiente',
  billed: 'En resumen',
  paid: 'Pagada',
  cancelled: 'Cancelada',
};
