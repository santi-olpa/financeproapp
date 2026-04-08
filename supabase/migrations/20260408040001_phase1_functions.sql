-- =============================================
-- FASE 1: Funciones SQL (vistas de cálculo)
-- Fuente de verdad: docs/02-data-model.md y docs/03-kpis.md
-- =============================================

-- =============================================
-- v_account_balance: saldo de una cuenta a una fecha
-- =============================================
CREATE OR REPLACE FUNCTION public.v_account_balance(p_account_id UUID, p_as_of DATE DEFAULT CURRENT_DATE)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_initial NUMERIC;
  v_balance NUMERIC;
BEGIN
  SELECT initial_balance INTO v_initial FROM accounts WHERE id = p_account_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT v_initial
    + COALESCE(SUM(CASE WHEN transaction_type = 'income' AND account_id = p_account_id THEN amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN transaction_type = 'expense' AND account_id = p_account_id THEN amount ELSE 0 END), 0)
    + COALESCE(SUM(CASE WHEN transaction_type IN ('transfer','card_payment') AND destination_account_id = p_account_id THEN amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN transaction_type IN ('transfer','card_payment') AND source_account_id = p_account_id THEN amount ELSE 0 END), 0)
    + COALESCE(SUM(CASE WHEN transaction_type = 'adjustment' AND account_id = p_account_id THEN amount ELSE 0 END), 0)
  INTO v_balance
  FROM transactions
  WHERE transaction_date <= p_as_of;

  RETURN COALESCE(v_balance, v_initial);
END;
$$;

-- =============================================
-- v_card_debt: deuda total de una tarjeta (cuotas no pagas)
-- =============================================
CREATE OR REPLACE FUNCTION public.v_card_debt(p_card_account_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(COALESCE(i.amount_ars, i.amount_original)), 0)
  FROM installments i
  JOIN purchases p ON p.id = i.purchase_id
  WHERE p.card_account_id = p_card_account_id
    AND i.status IN ('pending', 'billed')
    AND p.is_cancelled = false;
$$;

-- =============================================
-- v_card_statement_total: total a pagar de una tarjeta en un período
-- =============================================
CREATE OR REPLACE FUNCTION public.v_card_statement_total(p_card_account_id UUID, p_year INT, p_month INT)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(COALESCE(i.amount_ars, i.amount_original)), 0)
  FROM installments i
  JOIN purchases p ON p.id = i.purchase_id
  WHERE p.card_account_id = p_card_account_id
    AND i.billing_year = p_year
    AND i.billing_month = p_month
    AND p.is_cancelled = false;
$$;

-- =============================================
-- v_monthly_summary: LA función central de KPIs mensuales
-- =============================================
CREATE OR REPLACE FUNCTION public.v_monthly_summary(
  p_user_id UUID,
  p_year INT,
  p_month INT,
  p_currency public.currency_type DEFAULT 'ARS'
)
RETURNS TABLE(
  total_income NUMERIC,
  total_expense_cash NUMERIC,
  total_expense_accrued NUMERIC,
  net_cash NUMERIC,
  net_accrued NUMERIC,
  savings_rate NUMERIC,
  essential_expense NUMERIC,
  discretionary_expense NUMERIC,
  cards_committed NUMERIC,
  recurring_committed NUMERIC,
  unique_categories INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE := make_date(p_year, p_month, 1);
  v_end DATE := (v_start + interval '1 month - 1 day')::date;
BEGIN
  RETURN QUERY
  WITH tx AS (
    SELECT t.*, c.is_essential
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = p_user_id
      AND t.currency = p_currency
      AND t.transaction_date BETWEEN v_start AND v_end
  ),
  cards AS (
    SELECT COALESCE(SUM(COALESCE(i.amount_ars, i.amount_original)), 0) AS total
    FROM installments i
    JOIN purchases p ON p.id = i.purchase_id
    WHERE i.user_id = p_user_id
      AND i.billing_year = p_year
      AND i.billing_month = p_month
      AND p.original_currency = p_currency
      AND p.is_cancelled = false
  ),
  recurring AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM recurring_expenses
    WHERE user_id = p_user_id
      AND currency = p_currency
      AND is_active = true
      AND next_due_date BETWEEN v_start AND v_end
  )
  SELECT
    COALESCE(SUM(CASE WHEN tx.transaction_type = 'income' THEN tx.amount ELSE 0 END), 0)::numeric AS total_income,
    COALESCE(SUM(CASE WHEN tx.transaction_type = 'expense' THEN tx.amount ELSE 0 END), 0)::numeric AS total_expense_cash,
    (COALESCE(SUM(CASE WHEN tx.transaction_type = 'expense' THEN tx.amount ELSE 0 END), 0) + cards.total)::numeric AS total_expense_accrued,
    (COALESCE(SUM(CASE WHEN tx.transaction_type = 'income' THEN tx.amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN tx.transaction_type = 'expense' THEN tx.amount ELSE 0 END), 0))::numeric AS net_cash,
    (COALESCE(SUM(CASE WHEN tx.transaction_type = 'income' THEN tx.amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN tx.transaction_type = 'expense' THEN tx.amount ELSE 0 END), 0)
     - cards.total)::numeric AS net_accrued,
    CASE
      WHEN COALESCE(SUM(CASE WHEN tx.transaction_type = 'income' THEN tx.amount ELSE 0 END), 0) > 0
      THEN ((COALESCE(SUM(CASE WHEN tx.transaction_type = 'income' THEN tx.amount ELSE 0 END), 0)
             - COALESCE(SUM(CASE WHEN tx.transaction_type = 'expense' THEN tx.amount ELSE 0 END), 0))
             / COALESCE(SUM(CASE WHEN tx.transaction_type = 'income' THEN tx.amount ELSE 0 END), 0))::numeric
      ELSE 0::numeric
    END AS savings_rate,
    COALESCE(SUM(CASE WHEN tx.transaction_type = 'expense' AND tx.is_essential THEN tx.amount ELSE 0 END), 0)::numeric AS essential_expense,
    COALESCE(SUM(CASE WHEN tx.transaction_type = 'expense' AND NOT COALESCE(tx.is_essential, false) THEN tx.amount ELSE 0 END), 0)::numeric AS discretionary_expense,
    cards.total::numeric AS cards_committed,
    recurring.total::numeric AS recurring_committed,
    COUNT(DISTINCT tx.category_id)::int AS unique_categories
  FROM tx, cards, recurring
  GROUP BY cards.total, recurring.total;
END;
$$;

-- =============================================
-- v_liquidity: liquidez actual (cuentas operativas)
-- =============================================
CREATE OR REPLACE FUNCTION public.v_liquidity(p_user_id UUID, p_currency public.currency_type DEFAULT 'ARS')
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(v_account_balance(id)), 0)
  FROM accounts
  WHERE user_id = p_user_id
    AND currency = p_currency
    AND account_subtype = 'operating'
    AND is_active = true;
$$;

-- =============================================
-- v_net_worth: patrimonio neto = activos - pasivos
-- =============================================
CREATE OR REPLACE FUNCTION public.v_net_worth(p_user_id UUID, p_currency public.currency_type DEFAULT 'ARS')
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((
      SELECT SUM(v_account_balance(id))
      FROM accounts
      WHERE user_id = p_user_id
        AND currency = p_currency
        AND account_subtype IN ('operating', 'reserve', 'investment')
        AND is_active = true
    ), 0)
    -
    COALESCE((
      SELECT SUM(v_card_debt(id))
      FROM accounts
      WHERE user_id = p_user_id
        AND currency = p_currency
        AND account_subtype = 'liability'
        AND is_active = true
    ), 0);
$$;

-- =============================================
-- v_runway: meses de autonomía financiera
-- =============================================
CREATE OR REPLACE FUNCTION public.v_runway(p_user_id UUID, p_currency public.currency_type DEFAULT 'ARS')
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_liq NUMERIC;
  v_burn NUMERIC;
BEGIN
  v_liq := v_liquidity(p_user_id, p_currency);

  SELECT COALESCE(AVG(total_expense_accrued), 0) INTO v_burn
  FROM (
    SELECT (v_monthly_summary(p_user_id, EXTRACT(YEAR FROM d)::int, EXTRACT(MONTH FROM d)::int, p_currency)).total_expense_accrued AS total_expense_accrued
    FROM generate_series(
      date_trunc('month', CURRENT_DATE) - interval '3 months',
      date_trunc('month', CURRENT_DATE) - interval '1 month',
      interval '1 month'
    ) d
  ) sub;

  IF v_burn <= 0 THEN RETURN NULL; END IF;
  RETURN v_liq / v_burn;
END;
$$;

-- =============================================
-- v_projected_cashflow: proyección mes a mes
-- =============================================
CREATE OR REPLACE FUNCTION public.v_projected_cashflow(
  p_user_id UUID,
  p_months_ahead INT DEFAULT 6,
  p_currency public.currency_type DEFAULT 'ARS'
)
RETURNS TABLE(
  period_year INT,
  period_month INT,
  expected_income NUMERIC,
  recurring_expense NUMERIC,
  card_installments NUMERIC,
  total_committed NUMERIC,
  net_projected NUMERIC,
  cumulative_balance NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_income NUMERIC;
  v_running NUMERIC;
  rec RECORD;
BEGIN
  SELECT COALESCE(AVG(total_income), 0) INTO v_avg_income
  FROM (
    SELECT (v_monthly_summary(p_user_id, EXTRACT(YEAR FROM d)::int, EXTRACT(MONTH FROM d)::int, p_currency)).total_income
    FROM generate_series(
      date_trunc('month', CURRENT_DATE) - interval '3 months',
      date_trunc('month', CURRENT_DATE) - interval '1 month',
      interval '1 month'
    ) d
  ) sub;

  v_running := v_liquidity(p_user_id, p_currency);

  FOR rec IN
    SELECT EXTRACT(YEAR FROM d)::int AS yr, EXTRACT(MONTH FROM d)::int AS mo
    FROM generate_series(
      date_trunc('month', CURRENT_DATE),
      date_trunc('month', CURRENT_DATE) + ((p_months_ahead - 1) || ' months')::interval,
      interval '1 month'
    ) d
  LOOP
    period_year := rec.yr;
    period_month := rec.mo;
    expected_income := v_avg_income;

    SELECT COALESCE(SUM(re.amount), 0) INTO recurring_expense
    FROM recurring_expenses re
    WHERE re.user_id = p_user_id
      AND re.is_active = true
      AND re.currency = p_currency
      AND EXTRACT(YEAR FROM re.next_due_date) = rec.yr
      AND EXTRACT(MONTH FROM re.next_due_date) = rec.mo;

    SELECT COALESCE(SUM(COALESCE(i.amount_ars, i.amount_original)), 0) INTO card_installments
    FROM installments i
    JOIN purchases p ON p.id = i.purchase_id
    WHERE i.user_id = p_user_id
      AND i.billing_year = rec.yr
      AND i.billing_month = rec.mo
      AND p.is_cancelled = false
      AND p.original_currency = p_currency;

    total_committed := recurring_expense + card_installments;
    net_projected := expected_income - total_committed;
    v_running := v_running + net_projected;
    cumulative_balance := v_running;

    RETURN NEXT;
  END LOOP;
END;
$$;

-- =============================================
-- v_fixed_living_cost: costo de vida fijo mensual
-- =============================================
CREATE OR REPLACE FUNCTION public.v_fixed_living_cost(p_user_id UUID, p_currency public.currency_type DEFAULT 'ARS')
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recurring NUMERIC;
  v_essential_avg NUMERIC;
BEGIN
  -- Suma de recurrentes activos mensualizados
  SELECT COALESCE(SUM(amount), 0) INTO v_recurring
  FROM recurring_expenses
  WHERE user_id = p_user_id
    AND currency = p_currency
    AND is_active = true;

  -- Promedio 3 meses de gastos en categorías esenciales que NO vinieron de un recurrente
  SELECT COALESCE(AVG(monthly_essential), 0) INTO v_essential_avg
  FROM (
    SELECT SUM(t.amount) AS monthly_essential
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = p_user_id
      AND t.currency = p_currency
      AND t.transaction_type = 'expense'
      AND c.is_essential = true
      AND t.recurring_expense_id IS NULL
      AND t.transaction_date >= (date_trunc('month', CURRENT_DATE) - interval '3 months')::date
      AND t.transaction_date < date_trunc('month', CURRENT_DATE)::date
    GROUP BY EXTRACT(YEAR FROM t.transaction_date), EXTRACT(MONTH FROM t.transaction_date)
  ) sub;

  RETURN v_recurring + v_essential_avg;
END;
$$;

-- =============================================
-- v_card_load: carga de tarjetas (% de ingresos comprometidos)
-- =============================================
CREATE OR REPLACE FUNCTION public.v_card_load(p_user_id UUID, p_currency public.currency_type DEFAULT 'ARS')
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_pending NUMERIC;
  v_avg_income NUMERIC;
BEGIN
  -- Total de cuotas pendientes y futuras
  SELECT COALESCE(SUM(COALESCE(i.amount_ars, i.amount_original)), 0) INTO v_total_pending
  FROM installments i
  JOIN purchases p ON p.id = i.purchase_id
  WHERE i.user_id = p_user_id
    AND p.original_currency = p_currency
    AND i.status IN ('pending', 'billed')
    AND p.is_cancelled = false;

  -- Ingreso promedio mensual (últimos 3 meses)
  SELECT COALESCE(AVG(total_income), 0) INTO v_avg_income
  FROM (
    SELECT (v_monthly_summary(p_user_id, EXTRACT(YEAR FROM d)::int, EXTRACT(MONTH FROM d)::int, p_currency)).total_income
    FROM generate_series(
      date_trunc('month', CURRENT_DATE) - interval '3 months',
      date_trunc('month', CURRENT_DATE) - interval '1 month',
      interval '1 month'
    ) d
  ) sub;

  -- Carga = total pendiente / ingreso anual estimado
  IF v_avg_income <= 0 THEN RETURN NULL; END IF;
  RETURN v_total_pending / (v_avg_income * 12);
END;
$$;
