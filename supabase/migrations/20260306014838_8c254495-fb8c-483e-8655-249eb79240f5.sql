
-- Function to recalculate a single account's balance from initial_balance + all transactions
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

  -- Sum income transactions for this account
  SELECT COALESCE(SUM(amount), 0) INTO v_income
  FROM transactions
  WHERE account_id = p_account_id AND transaction_type = 'income';

  -- Sum expense transactions for this account
  SELECT COALESCE(SUM(amount), 0) INTO v_expense
  FROM transactions
  WHERE account_id = p_account_id AND transaction_type = 'expense';

  -- Sum transfers IN (this account is destination)
  SELECT COALESCE(SUM(amount), 0) INTO v_transfers_in
  FROM transactions
  WHERE destination_account_id = p_account_id AND transaction_type = 'transfer';

  -- Sum transfers OUT (this account is source)
  SELECT COALESCE(SUM(amount), 0) INTO v_transfers_out
  FROM transactions
  WHERE source_account_id = p_account_id AND transaction_type = 'transfer';

  -- Calculate new balance
  v_new_balance := v_initial + v_income - v_expense + v_transfers_in - v_transfers_out;

  -- Update the account
  UPDATE accounts SET current_balance = v_new_balance WHERE id = p_account_id;

  RETURN v_new_balance;
END;
$$;

-- Function to recalculate ALL accounts for a user
CREATE OR REPLACE FUNCTION public.recalculate_all_account_balances(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  FOR v_account_id IN SELECT id FROM accounts WHERE user_id = p_user_id
  LOOP
    PERFORM recalculate_account_balance(v_account_id);
  END LOOP;
END;
$$;
