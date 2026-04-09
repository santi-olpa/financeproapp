-- =============================================
-- FASE 0: Corregir recalculate_account_balance
-- Agregar filtro transaction_date <= CURRENT_DATE para que
-- cuotas futuras no inflen/desinflen el saldo actual.
-- =============================================

CREATE OR REPLACE FUNCTION public.recalculate_account_balance(p_account_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_initial numeric;
  v_income numeric;
  v_expense numeric;
  v_transfers_in numeric;
  v_transfers_out numeric;
  v_new_balance numeric;
BEGIN
  -- Get initial balance
  SELECT initial_balance INTO v_initial
  FROM accounts WHERE id = p_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  -- Sum income transactions for this account (solo hasta hoy)
  SELECT COALESCE(SUM(amount), 0) INTO v_income
  FROM transactions
  WHERE account_id = p_account_id
    AND transaction_type = 'income'
    AND transaction_date <= CURRENT_DATE;

  -- Sum expense transactions for this account (solo hasta hoy)
  SELECT COALESCE(SUM(amount), 0) INTO v_expense
  FROM transactions
  WHERE account_id = p_account_id
    AND transaction_type = 'expense'
    AND transaction_date <= CURRENT_DATE;

  -- Sum transfers IN (this account is destination, solo hasta hoy)
  SELECT COALESCE(SUM(amount), 0) INTO v_transfers_in
  FROM transactions
  WHERE destination_account_id = p_account_id
    AND transaction_type = 'transfer'
    AND transaction_date <= CURRENT_DATE;

  -- Sum transfers OUT (this account is source, solo hasta hoy)
  SELECT COALESCE(SUM(amount), 0) INTO v_transfers_out
  FROM transactions
  WHERE source_account_id = p_account_id
    AND transaction_type = 'transfer'
    AND transaction_date <= CURRENT_DATE;

  -- Calculate new balance
  v_new_balance := v_initial + v_income - v_expense + v_transfers_in - v_transfers_out;

  -- Update the account
  UPDATE accounts SET current_balance = v_new_balance WHERE id = p_account_id;

  RETURN v_new_balance;
END;
$$;
