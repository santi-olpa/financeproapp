import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { addDays, addWeeks, addMonths, addYears, format, isBefore, isEqual, startOfDay } from 'https://esm.sh/date-fns@3.6.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RecurringExpense {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: 'ARS' | 'USD';
  category_id: string | null;
  account_id: string | null;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  next_due_date: string;
  is_active: boolean;
  last_generated_date: string | null;
}

function calculateNextDueDate(currentDate: string, frequency: string): string {
  const date = new Date(currentDate);
  
  switch (frequency) {
    case 'weekly':
      return format(addWeeks(date, 1), 'yyyy-MM-dd');
    case 'biweekly':
      return format(addWeeks(date, 2), 'yyyy-MM-dd');
    case 'monthly':
      return format(addMonths(date, 1), 'yyyy-MM-dd');
    case 'quarterly':
      return format(addMonths(date, 3), 'yyyy-MM-dd');
    case 'yearly':
      return format(addYears(date, 1), 'yyyy-MM-dd');
    default:
      return format(addMonths(date, 1), 'yyyy-MM-dd');
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    
    console.log(`Processing recurring expenses for date: ${todayStr}`);

    // Fetch all active recurring expenses where next_due_date <= today
    const { data: expenses, error: fetchError } = await supabase
      .from('recurring_expenses')
      .select('*')
      .eq('is_active', true)
      .lte('next_due_date', todayStr);

    if (fetchError) {
      console.error('Error fetching recurring expenses:', fetchError);
      throw fetchError;
    }

    if (!expenses || expenses.length === 0) {
      console.log('No recurring expenses to process today');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No recurring expenses to process',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expenses.length} recurring expenses to process`);

    let processedCount = 0;
    let errorCount = 0;
    const results: { id: string; name: string; status: string; error?: string }[] = [];

    for (const expense of expenses as RecurringExpense[]) {
      try {
        console.log(`Processing: ${expense.name} (ID: ${expense.id})`);

        // Create transaction
        const { data: transaction, error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: expense.user_id,
            transaction_type: 'expense',
            amount: expense.amount,
            currency: expense.currency,
            description: expense.name,
            transaction_date: expense.next_due_date,
            account_id: expense.account_id,
            category_id: expense.category_id,
            recurring_expense_id: expense.id,
            notes: `Generado automáticamente - ${expense.description || expense.name}`,
          })
          .select()
          .single();

        if (txError) {
          console.error(`Error creating transaction for ${expense.name}:`, txError);
          results.push({ id: expense.id, name: expense.name, status: 'error', error: txError.message });
          errorCount++;
          continue;
        }

        console.log(`Transaction created: ${transaction.id}`);

        // Update account balance if account is set
        if (expense.account_id) {
          const { error: balanceError } = await supabase.rpc('update_account_balance_on_expense', {
            p_account_id: expense.account_id,
            p_amount: expense.amount
          });

          // If RPC doesn't exist, do a manual update
          if (balanceError) {
            console.log('RPC not found, using direct update');
            const { data: account } = await supabase
              .from('accounts')
              .select('current_balance')
              .eq('id', expense.account_id)
              .single();

            if (account) {
              await supabase
                .from('accounts')
                .update({ 
                  current_balance: Number(account.current_balance) - expense.amount 
                })
                .eq('id', expense.account_id);
            }
          }
        }

        // Calculate next due date
        const nextDueDate = calculateNextDueDate(expense.next_due_date, expense.frequency);

        // Update recurring expense with new next_due_date
        const { error: updateError } = await supabase
          .from('recurring_expenses')
          .update({
            next_due_date: nextDueDate,
            last_generated_date: expense.next_due_date,
          })
          .eq('id', expense.id);

        if (updateError) {
          console.error(`Error updating recurring expense ${expense.name}:`, updateError);
          results.push({ id: expense.id, name: expense.name, status: 'partial', error: 'Transaction created but failed to update next date' });
        } else {
          results.push({ id: expense.id, name: expense.name, status: 'success' });
          processedCount++;
        }

        console.log(`Updated next_due_date for ${expense.name}: ${nextDueDate}`);

      } catch (expenseError) {
        console.error(`Error processing expense ${expense.id}:`, expenseError);
        results.push({ 
          id: expense.id, 
          name: expense.name, 
          status: 'error', 
          error: expenseError instanceof Error ? expenseError.message : 'Unknown error' 
        });
        errorCount++;
      }
    }

    console.log(`Processing complete. Success: ${processedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} recurring expenses`,
        processed: processedCount,
        errors: errorCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-recurring-expenses:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
