-- =============================================
-- Fase 2.5: Cheques y eventos pendientes
-- Tabla pending_events + enums + funciones SQL + actualizar v_net_worth y v_runway
-- =============================================

-- === ENUMS ===
DO $$ BEGIN
  CREATE TYPE public.pending_event_kind AS ENUM ('check_received', 'check_issued', 'transfer_expected', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.pending_event_direction AS ENUM ('in', 'out');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.pending_event_status AS ENUM ('pending', 'cleared', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- === TABLA pending_events ===
CREATE TABLE IF NOT EXISTS public.pending_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind                     public.pending_event_kind NOT NULL,
  direction                public.pending_event_direction NOT NULL,
  amount                   NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  currency                 public.currency_type NOT NULL DEFAULT 'ARS',
  counterparty_name        TEXT NOT NULL,
  description              TEXT,
  category_id              UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  issue_date               DATE NOT NULL,
  expected_date            DATE NOT NULL,
  target_account_id        UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  check_number             TEXT,
  check_bank               TEXT,
  is_echeq                 BOOLEAN NOT NULL DEFAULT false,
  status                   public.pending_event_status NOT NULL DEFAULT 'pending',
  cleared_at               TIMESTAMPTZ,
  cleared_transaction_id   UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  rejected_at              TIMESTAMPTZ,
  rejection_reason         TEXT,
  cancelled_at             TIMESTAMPTZ,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT expected_not_before_issue CHECK (expected_date >= issue_date),
  CONSTRAINT direction_matches_kind CHECK (
    (kind = 'check_received' AND direction = 'in') OR
    (kind = 'check_issued' AND direction = 'out') OR
    (kind = 'transfer_expected' AND direction = 'in') OR
    (kind = 'other')
  ),
  CONSTRAINT cleared_has_metadata CHECK (
    (status <> 'cleared') OR (cleared_at IS NOT NULL AND cleared_transaction_id IS NOT NULL AND target_account_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_pending_events_user_status ON public.pending_events(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_events_expected_date ON public.pending_events(user_id, expected_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pending_events_kind ON public.pending_events(user_id, kind) WHERE status = 'pending';

-- RLS
ALTER TABLE public.pending_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_pending_events" ON public.pending_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_pending_events" ON public.pending_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_pending_events" ON public.pending_events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_pending_events" ON public.pending_events FOR DELETE USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER trg_pending_events_updated BEFORE UPDATE ON public.pending_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === FUNCIONES SQL ===

-- v_pending_events_summary
CREATE OR REPLACE FUNCTION public.v_pending_events_summary(
  p_user_id UUID,
  p_currency public.currency_type DEFAULT 'ARS',
  p_max_horizon_days INTEGER DEFAULT NULL
)
RETURNS TABLE (
  direction public.pending_event_direction,
  kind public.pending_event_kind,
  count_events BIGINT,
  total_amount NUMERIC(15, 2),
  next_expected_date DATE
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    direction,
    kind,
    COUNT(*)::BIGINT,
    COALESCE(SUM(amount), 0)::NUMERIC(15,2),
    MIN(expected_date)
  FROM pending_events
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND currency = p_currency
    AND (
      p_max_horizon_days IS NULL
      OR expected_date <= CURRENT_DATE + (p_max_horizon_days || ' days')::INTERVAL
    )
  GROUP BY direction, kind;
$$;

-- clear_pending_event: marca como cleared y crea la transaction real
CREATE OR REPLACE FUNCTION public.clear_pending_event(
  p_event_id UUID,
  p_target_account_id UUID,
  p_actual_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event pending_events%ROWTYPE;
  v_transaction_id UUID;
  v_tx_type public.transaction_type;
BEGIN
  SELECT * INTO v_event
  FROM pending_events
  WHERE id = p_event_id AND user_id = auth.uid() AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento pendiente no encontrado o ya procesado';
  END IF;

  v_tx_type := CASE v_event.direction
    WHEN 'in' THEN 'income'::public.transaction_type
    WHEN 'out' THEN 'expense'::public.transaction_type
  END;

  INSERT INTO transactions (
    user_id, account_id, category_id, transaction_type, amount, currency, description, transaction_date
  ) VALUES (
    auth.uid(),
    p_target_account_id,
    v_event.category_id,
    v_tx_type,
    v_event.amount,
    v_event.currency,
    CASE v_event.kind
      WHEN 'check_received' THEN 'Cheque cobrado: ' || COALESCE(v_event.description, v_event.counterparty_name)
      WHEN 'check_issued' THEN 'Cheque pagado: ' || COALESCE(v_event.description, v_event.counterparty_name)
      ELSE COALESCE(v_event.description, v_event.counterparty_name)
    END,
    p_actual_date
  ) RETURNING id INTO v_transaction_id;

  UPDATE pending_events
  SET status = 'cleared',
      cleared_at = now(),
      cleared_transaction_id = v_transaction_id,
      target_account_id = p_target_account_id,
      updated_at = now()
  WHERE id = p_event_id;

  RETURN v_transaction_id;
END;
$$;

-- reject_pending_event
CREATE OR REPLACE FUNCTION public.reject_pending_event(p_event_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE pending_events
  SET status = 'rejected', rejected_at = now(), rejection_reason = p_reason, updated_at = now()
  WHERE id = p_event_id AND user_id = auth.uid() AND status = 'pending';
$$;

-- cancel_pending_event
CREATE OR REPLACE FUNCTION public.cancel_pending_event(p_event_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE pending_events
  SET status = 'cancelled', cancelled_at = now(), updated_at = now()
  WHERE id = p_event_id AND user_id = auth.uid() AND status = 'pending';
$$;

-- === ACTUALIZAR v_net_worth: sumar pending events ===
CREATE OR REPLACE FUNCTION public.v_net_worth(p_user_id UUID, p_currency public.currency_type DEFAULT 'ARS')
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((
      SELECT SUM(v_account_balance(id))
      FROM accounts
      WHERE user_id = p_user_id AND currency = p_currency
        AND account_subtype IN ('operating', 'reserve', 'investment') AND is_active = true
    ), 0)
    -
    COALESCE((
      SELECT SUM(v_card_debt(id))
      FROM accounts
      WHERE user_id = p_user_id AND currency = p_currency
        AND account_subtype = 'liability' AND is_active = true
    ), 0)
    +
    COALESCE((
      SELECT SUM(amount) FROM pending_events
      WHERE user_id = p_user_id AND currency = p_currency AND direction = 'in' AND status = 'pending'
    ), 0)
    -
    COALESCE((
      SELECT SUM(amount) FROM pending_events
      WHERE user_id = p_user_id AND currency = p_currency AND direction = 'out' AND status = 'pending'
    ), 0);
$$;

-- === ACTUALIZAR v_runway: incluir pending events 90 días ===
CREATE OR REPLACE FUNCTION public.v_runway(p_user_id UUID, p_currency public.currency_type DEFAULT 'ARS')
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_liq NUMERIC;
  v_pending_in_90 NUMERIC;
  v_pending_out_90 NUMERIC;
  v_available NUMERIC;
  v_burn NUMERIC;
BEGIN
  v_liq := v_liquidity(p_user_id, p_currency);

  SELECT COALESCE(SUM(amount), 0) INTO v_pending_in_90
  FROM pending_events
  WHERE user_id = p_user_id AND currency = p_currency
    AND direction = 'in' AND status = 'pending'
    AND expected_date <= CURRENT_DATE + INTERVAL '90 days';

  SELECT COALESCE(SUM(amount), 0) INTO v_pending_out_90
  FROM pending_events
  WHERE user_id = p_user_id AND currency = p_currency
    AND direction = 'out' AND status = 'pending'
    AND expected_date <= CURRENT_DATE + INTERVAL '90 days';

  v_available := v_liq + v_pending_in_90 - v_pending_out_90;

  SELECT COALESCE(AVG(total_expense_accrued), 0) INTO v_burn
  FROM (
    SELECT (v_monthly_summary(p_user_id, EXTRACT(YEAR FROM d)::int, EXTRACT(MONTH FROM d)::int, p_currency)).total_expense_accrued
    FROM generate_series(
      date_trunc('month', CURRENT_DATE) - interval '3 months',
      date_trunc('month', CURRENT_DATE) - interval '1 month',
      interval '1 month'
    ) d
  ) sub;

  IF v_burn <= 0 THEN RETURN NULL; END IF;
  RETURN v_available / v_burn;
END;
$$;
