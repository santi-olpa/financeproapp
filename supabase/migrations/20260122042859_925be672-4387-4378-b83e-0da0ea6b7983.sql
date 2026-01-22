-- Create recurring_expenses table
CREATE TABLE public.recurring_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  currency currency_type NOT NULL DEFAULT 'ARS',
  category_id UUID REFERENCES public.categories(id),
  account_id UUID REFERENCES public.accounts(id),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_due_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own recurring expenses"
ON public.recurring_expenses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring expenses"
ON public.recurring_expenses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring expenses"
ON public.recurring_expenses FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring expenses"
ON public.recurring_expenses FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_recurring_expenses_updated_at
BEFORE UPDATE ON public.recurring_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add price_history column to track amount changes with effective dates
ALTER TABLE public.recurring_expenses 
ADD COLUMN price_history JSONB DEFAULT '[]'::jsonb;

-- Add recurring_expense_id to transactions to link generated transactions
ALTER TABLE public.transactions
ADD COLUMN recurring_expense_id UUID REFERENCES public.recurring_expenses(id);

-- Add privacy preference to profiles
ALTER TABLE public.profiles
ADD COLUMN hide_amounts BOOLEAN DEFAULT false;