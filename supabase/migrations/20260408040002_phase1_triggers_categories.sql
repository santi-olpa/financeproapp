-- =============================================
-- FASE 1: Triggers + Categorías de sistema actualizadas
-- =============================================

-- =============================================
-- TRIGGERS: updated_at para tablas nuevas
-- =============================================

-- La función update_updated_at() ya existe de la migración inicial
CREATE TRIGGER trg_purchases_updated BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON public.financial_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_card_statements_updated BEFORE UPDATE ON public.card_statements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Recrear trigger de transactions (fue droppeada y recreada)
DROP TRIGGER IF EXISTS trg_transactions_updated ON public.transactions;
CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- TRIGGER: accrue_purchase
-- Al insertar una compra, genera automáticamente las cuotas
-- =============================================

CREATE OR REPLACE FUNCTION public.accrue_purchase()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_card RECORD;
  v_billing_start DATE;
  v_installment_amount NUMERIC;
  i INT;
  v_y INT;
  v_m INT;
BEGIN
  SELECT closing_day INTO v_card FROM accounts WHERE id = NEW.card_account_id;

  -- La primera cuota se imputa al mes del próximo cierre posterior a la compra
  IF EXTRACT(DAY FROM NEW.purchase_date) <= v_card.closing_day THEN
    v_billing_start := date_trunc('month', NEW.purchase_date)::date;
  ELSE
    v_billing_start := (date_trunc('month', NEW.purchase_date) + interval '1 month')::date;
  END IF;

  v_installment_amount := ROUND((NEW.total_amount * (1 + NEW.interest_rate / 100)) / NEW.installments_count, 2);

  FOR i IN 1..NEW.installments_count LOOP
    v_y := EXTRACT(YEAR FROM v_billing_start + ((i - 1) || ' months')::interval)::int;
    v_m := EXTRACT(MONTH FROM v_billing_start + ((i - 1) || ' months')::interval)::int;

    INSERT INTO installments (user_id, purchase_id, installment_number, amount_original, billing_year, billing_month, status)
    VALUES (NEW.user_id, NEW.id, i, v_installment_amount, v_y, v_m,
      CASE
        WHEN v_y = EXTRACT(YEAR FROM CURRENT_DATE)::int AND v_m = EXTRACT(MONTH FROM CURRENT_DATE)::int
        THEN 'billed'::installment_status
        ELSE 'pending'::installment_status
      END
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accrue_purchase AFTER INSERT ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION accrue_purchase();

-- =============================================
-- CATEGORÍAS DE SISTEMA: reemplazar con las nuevas (con is_essential y display_order)
-- =============================================

-- Vaciar categorías existentes (ya están vacías por Fase 0, pero por seguridad)
DELETE FROM public.categories WHERE is_system = true;

INSERT INTO public.categories (name, category_type, icon, color, is_system, is_essential, display_order) VALUES
-- Ingresos
('Sueldo', 'income', 'briefcase', '#22c55e', true, false, 1),
('Freelance', 'income', 'laptop', '#10b981', true, false, 2),
('Comisiones', 'income', 'percent', '#14b8a6', true, false, 3),
('Ventas', 'income', 'shopping-bag', '#06b6d4', true, false, 4),
('Reintegros', 'income', 'rotate-ccw', '#0ea5e9', true, false, 5),
('Otros ingresos', 'income', 'plus-circle', '#3b82f6', true, false, 6),
-- Egresos esenciales
('Alquiler / Vivienda', 'expense', 'home', '#dc2626', true, true, 1),
('Servicios (luz, agua, gas)', 'expense', 'zap', '#ea580c', true, true, 2),
('Internet y telefonía', 'expense', 'wifi', '#f59e0b', true, true, 3),
('Supermercado', 'expense', 'shopping-cart', '#84cc16', true, true, 4),
('Transporte', 'expense', 'car', '#f97316', true, true, 5),
('Salud', 'expense', 'heart', '#ec4899', true, true, 6),
('Educación', 'expense', 'book-open', '#6366f1', true, true, 7),
-- Egresos discrecionales
('Restaurantes y delivery', 'expense', 'utensils', '#ef4444', true, false, 8),
('Entretenimiento', 'expense', 'film', '#a855f7', true, false, 9),
('Compras (ropa, tecnología)', 'expense', 'shopping-bag', '#8b5cf6', true, false, 10),
('Suscripciones', 'expense', 'repeat', '#06b6d4', true, false, 11),
('Viajes', 'expense', 'plane', '#0ea5e9', true, false, 12),
('Hogar (mantenimiento, deco)', 'expense', 'sofa', '#f59e0b', true, false, 13),
('Mascotas', 'expense', 'paw-print', '#10b981', true, false, 14),
('Regalos y donaciones', 'expense', 'gift', '#ec4899', true, false, 15),
('Otros gastos', 'expense', 'minus-circle', '#64748b', true, false, 99);
