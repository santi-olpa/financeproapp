-- =============================================
-- FASE 1: Modelo de datos nuevo
-- Migración completa del esquema descrito en docs/02-data-model.md
-- Precondición: Fase 0 ya ejecutada (tablas vacías).
-- =============================================

-- =============================================
-- 1. ENUMS: agregar valores y crear nuevos
-- =============================================

-- Agregar valores faltantes a account_type
ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'credit_card';
ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'savings';

-- Agregar card_payment a transaction_type
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'card_payment';

-- Crear enums nuevos
DO $$ BEGIN
  CREATE TYPE public.account_subtype AS ENUM ('operating', 'reserve', 'liability', 'investment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.recurring_frequency AS ENUM ('weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.installment_status AS ENUM ('pending', 'billed', 'paid', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.goal_type AS ENUM ('savings', 'habit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 2. MODIFICAR TABLAS EXISTENTES
-- =============================================

-- === profiles ===
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS primary_kpi TEXT NOT NULL DEFAULT 'runway';

-- Agregar CHECK constraint para primary_kpi
DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_primary_kpi_check
    CHECK (primary_kpi IN ('runway', 'savings_rate', 'net_worth'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- === accounts ===
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS account_subtype public.account_subtype,
  ADD COLUMN IF NOT EXISTS closing_day INTEGER,
  ADD COLUMN IF NOT EXISTS due_day INTEGER,
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS default_payment_account_id UUID;

-- Constraints para accounts
DO $$ BEGIN
  ALTER TABLE public.accounts ADD CONSTRAINT accounts_closing_day_check
    CHECK (closing_day BETWEEN 1 AND 31);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.accounts ADD CONSTRAINT accounts_due_day_check
    CHECK (due_day BETWEEN 1 AND 31);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.accounts ADD CONSTRAINT credit_card_has_dates
    CHECK (account_type != 'credit_card' OR (closing_day IS NOT NULL AND due_day IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.accounts ADD CONSTRAINT accounts_payment_account_fk
    FOREIGN KEY (default_payment_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Índices nuevos para accounts
CREATE INDEX IF NOT EXISTS idx_accounts_user ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_active ON public.accounts(user_id, is_active);

-- === categories ===
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_essential BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories(user_id);

-- === transactions: DROP y recrear (está vacía) ===
-- Primero borrar la vieja tabla installments que depende de transactions
DROP TABLE IF EXISTS public.installments CASCADE;
-- Borrar monthly_snapshots si existe
DROP TABLE IF EXISTS public.monthly_snapshots CASCADE;
-- Borrar la tabla transactions vieja
DROP TABLE IF EXISTS public.transactions CASCADE;

-- Recrear transactions con el nuevo esquema
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type public.transaction_type NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency public.currency_type NOT NULL,
  description TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Para income/expense
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  -- Para transfer / card_payment
  source_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  destination_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  -- Vínculos (FK se agregan después de crear las tablas referenciadas)
  recurring_expense_id UUID,
  installment_id UUID,
  card_statement_id UUID,
  -- Verificación
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_account ON public.transactions(account_id);
CREATE INDEX idx_transactions_category ON public.transactions(category_id);
CREATE INDEX idx_transactions_type ON public.transactions(user_id, transaction_type);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 3. CREAR TABLAS NUEVAS
-- =============================================

-- === purchases ===
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  merchant TEXT,
  description TEXT NOT NULL,
  purchase_date DATE NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL CHECK (total_amount > 0),
  original_currency public.currency_type NOT NULL,
  installments_count INTEGER NOT NULL DEFAULT 1 CHECK (installments_count >= 1),
  interest_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  card_dollar_rate_override NUMERIC(15,2),
  notes TEXT,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchases_user ON public.purchases(user_id);
CREATE INDEX idx_purchases_card ON public.purchases(card_account_id);
CREATE INDEX idx_purchases_date ON public.purchases(user_id, purchase_date DESC);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_purchases" ON public.purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_purchases" ON public.purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_purchases" ON public.purchases FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_purchases" ON public.purchases FOR DELETE USING (auth.uid() = user_id);

-- === installments (nueva) ===
CREATE TABLE public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL CHECK (installment_number >= 1),
  amount_original NUMERIC(15,2) NOT NULL,
  amount_ars NUMERIC(15,2),
  billing_year INTEGER NOT NULL,
  billing_month INTEGER NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
  status public.installment_status NOT NULL DEFAULT 'pending',
  paid_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  UNIQUE (purchase_id, installment_number),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_installments_user_period ON public.installments(user_id, billing_year, billing_month);
CREATE INDEX idx_installments_purchase ON public.installments(purchase_id);
CREATE INDEX idx_installments_status ON public.installments(user_id, status);

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_installments" ON public.installments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_installments" ON public.installments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_installments" ON public.installments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_installments" ON public.installments FOR DELETE USING (auth.uid() = user_id);

-- === card_statements ===
CREATE TABLE public.card_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  closing_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_ars NUMERIC(15,2) NOT NULL DEFAULT 0,
  card_dollar_rate NUMERIC(15,2),
  is_estimated BOOLEAN NOT NULL DEFAULT true,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  UNIQUE (card_account_id, period_year, period_month),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_statements_card ON public.card_statements(card_account_id);
CREATE INDEX idx_card_statements_period ON public.card_statements(user_id, period_year, period_month);

ALTER TABLE public.card_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_card_statements" ON public.card_statements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_card_statements" ON public.card_statements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_card_statements" ON public.card_statements FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_card_statements" ON public.card_statements FOR DELETE USING (auth.uid() = user_id);

-- === financial_goals ===
CREATE TABLE public.financial_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type public.goal_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC(15,2),
  target_date DATE,
  current_amount NUMERIC(15,2) DEFAULT 0,
  linked_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  habit_percentage NUMERIC(5,2),
  habit_period TEXT CHECK (habit_period IN ('weekly', 'monthly', 'yearly')),
  currency public.currency_type NOT NULL DEFAULT 'ARS',
  is_active BOOLEAN NOT NULL DEFAULT true,
  achieved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goals_user ON public.financial_goals(user_id);
CREATE INDEX idx_goals_active ON public.financial_goals(user_id, is_active);

ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_goals" ON public.financial_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_goals" ON public.financial_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_goals" ON public.financial_goals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_goals" ON public.financial_goals FOR DELETE USING (auth.uid() = user_id);

-- === monthly_budgets ===
CREATE TABLE public.monthly_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency public.currency_type NOT NULL DEFAULT 'ARS',
  UNIQUE (user_id, category_id, year, month),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budgets_period ON public.monthly_budgets(user_id, year, month);

ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_budgets" ON public.monthly_budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_budgets" ON public.monthly_budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_budgets" ON public.monthly_budgets FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_budgets" ON public.monthly_budgets FOR DELETE USING (auth.uid() = user_id);

-- === exchange_rates ===
CREATE TABLE public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date DATE NOT NULL,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('oficial', 'tarjeta', 'mep', 'blue')),
  ars_per_usd NUMERIC(15,4) NOT NULL,
  source TEXT NOT NULL DEFAULT 'dolarapi',
  UNIQUE (rate_date, rate_type),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exchange_rates_date_type ON public.exchange_rates(rate_date DESC, rate_type);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_exchange_rates" ON public.exchange_rates FOR SELECT TO authenticated USING (true);

-- =============================================
-- 4. FK diferidas en transactions (ahora que existen las tablas)
-- =============================================

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_recurring_expense_fk
    FOREIGN KEY (recurring_expense_id) REFERENCES public.recurring_expenses(id) ON DELETE SET NULL;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_installment_fk
    FOREIGN KEY (installment_id) REFERENCES public.installments(id) ON DELETE SET NULL;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_card_statement_fk
    FOREIGN KEY (card_statement_id) REFERENCES public.card_statements(id) ON DELETE SET NULL;

-- =============================================
-- 5. Actualizar recurring_expenses: cambiar frequency de text a enum
-- =============================================

-- La columna frequency es text, necesitamos castear a recurring_frequency
ALTER TABLE public.recurring_expenses
  ALTER COLUMN frequency TYPE public.recurring_frequency USING frequency::public.recurring_frequency;

-- =============================================
-- 6. Actualizar RLS de categories (permitir ver system + propias)
-- =============================================

-- Borrar políticas viejas de categories
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can view system categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

-- Recrear con el patrón correcto
CREATE POLICY "select_categories" ON public.categories
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "insert_own_categories" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_system = false);
CREATE POLICY "update_own_categories" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id AND is_system = false);
CREATE POLICY "delete_own_categories" ON public.categories
  FOR DELETE USING (auth.uid() = user_id AND is_system = false);
