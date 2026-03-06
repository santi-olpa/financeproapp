
-- Function to get monthly patrimony history from transactions
-- Returns monthly income, expense, and running patrimony total
CREATE OR REPLACE FUNCTION public.get_patrimony_history(p_user_id uuid, p_currency text DEFAULT 'ARS', p_months int DEFAULT 12)
RETURNS TABLE(
  period_year int,
  period_month int,
  total_income numeric,
  total_expense numeric,
  net_change numeric,
  cumulative_patrimony numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_initial_balance numeric;
  v_running_total numeric;
  rec RECORD;
BEGIN
  -- Get total initial balance across all accounts of this currency
  SELECT COALESCE(SUM(initial_balance), 0) INTO v_initial_balance
  FROM accounts
  WHERE user_id = p_user_id AND currency::text = p_currency;

  -- Calculate cumulative patrimony from the beginning up to the start of our window
  -- to get the correct starting point
  SELECT v_initial_balance + COALESCE(SUM(
    CASE 
      WHEN t.transaction_type = 'income' AND t.account_id IS NOT NULL THEN t.amount
      WHEN t.transaction_type = 'expense' AND t.account_id IS NOT NULL THEN -t.amount
      WHEN t.transaction_type = 'transfer' AND t.source_account_id IS NOT NULL THEN 0 -- transfers are net zero
      ELSE 0
    END
  ), 0) INTO v_running_total
  FROM transactions t
  JOIN accounts a ON (
    a.id = t.account_id 
    OR a.id = t.source_account_id 
    OR a.id = t.destination_account_id
  )
  WHERE t.user_id = p_user_id 
    AND a.currency::text = p_currency
    AND t.transaction_date < date_trunc('month', CURRENT_DATE) - (p_months || ' months')::interval;

  -- Now iterate through each month in our window
  FOR rec IN
    SELECT 
      EXTRACT(YEAR FROM m.month_start)::int AS yr,
      EXTRACT(MONTH FROM m.month_start)::int AS mo,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END), 0) AS inc,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' THEN t.amount ELSE 0 END), 0) AS exp
    FROM generate_series(
      date_trunc('month', CURRENT_DATE) - ((p_months - 1) || ' months')::interval,
      date_trunc('month', CURRENT_DATE),
      '1 month'::interval
    ) AS m(month_start)
    LEFT JOIN transactions t ON 
      t.user_id = p_user_id
      AND t.transaction_date >= m.month_start::date
      AND t.transaction_date < (m.month_start + '1 month'::interval)::date
      AND t.transaction_type IN ('income', 'expense')
      AND EXISTS (
        SELECT 1 FROM accounts a 
        WHERE a.id = t.account_id AND a.currency::text = p_currency
      )
    GROUP BY m.month_start
    ORDER BY m.month_start
  LOOP
    v_running_total := v_running_total + rec.inc - rec.exp;
    
    period_year := rec.yr;
    period_month := rec.mo;
    total_income := rec.inc;
    total_expense := rec.exp;
    net_change := rec.inc - rec.exp;
    cumulative_patrimony := v_running_total;
    RETURN NEXT;
  END LOOP;
END;
$$;
