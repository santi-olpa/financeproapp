-- =============================================
-- FASE 0: Reset de datos
-- Vaciar todas las tablas de datos manteniendo profiles y auth intactos.
-- Las categorías de sistema se reinsertan después del truncate.
-- =============================================

-- Desactivar triggers temporalmente para evitar side-effects durante truncate
SET session_replication_role = 'replica';

-- Truncar tablas de datos en orden seguro (por dependencias FK)
TRUNCATE TABLE public.installments CASCADE;
TRUNCATE TABLE public.transactions CASCADE;
TRUNCATE TABLE public.monthly_snapshots CASCADE;
TRUNCATE TABLE public.recurring_expenses CASCADE;
TRUNCATE TABLE public.accounts CASCADE;
-- Categories: solo borrar las que no son de sistema (user-created)
-- Primero borramos todas y reinsertamos las de sistema
TRUNCATE TABLE public.categories CASCADE;

-- Reactivar triggers
SET session_replication_role = 'origin';

-- Reinsertar categorías de sistema (copiadas de la migración inicial)
INSERT INTO public.categories (name, icon, color, category_type, is_system) VALUES
  -- Ingresos
  ('Salario', 'Briefcase', '#10B981', 'income', true),
  ('Freelance', 'Laptop', '#6366F1', 'income', true),
  ('Inversiones', 'TrendingUp', '#F59E0B', 'income', true),
  ('Ventas', 'ShoppingBag', '#EC4899', 'income', true),
  ('Alquiler', 'Home', '#8B5CF6', 'income', true),
  ('Regalos', 'Gift', '#14B8A6', 'income', true),
  ('Reembolsos', 'RotateCcw', '#64748B', 'income', true),
  ('Intereses', 'Percent', '#0EA5E9', 'income', true),
  ('Otros Ingresos', 'Plus', '#78716C', 'income', true),
  -- Egresos
  ('Supermercado', 'ShoppingCart', '#EF4444', 'expense', true),
  ('Restaurantes', 'UtensilsCrossed', '#F97316', 'expense', true),
  ('Transporte', 'Car', '#3B82F6', 'expense', true),
  ('Servicios', 'Zap', '#A855F7', 'expense', true),
  ('Salud', 'Heart', '#EC4899', 'expense', true),
  ('Educación', 'GraduationCap', '#6366F1', 'expense', true),
  ('Entretenimiento', 'Gamepad2', '#F59E0B', 'expense', true),
  ('Hogar', 'Home', '#14B8A6', 'expense', true),
  ('Otros Gastos', 'MoreHorizontal', '#64748B', 'expense', true);
