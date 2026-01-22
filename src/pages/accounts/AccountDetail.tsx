import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowLeftRight,
  Plus,
  Pencil,
  Filter
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Account, Transaction, Category } from '@/types/finance';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [filterType, setFilterType] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');

  const { data: account, isLoading: loadingAccount } = useQuery({
    queryKey: ['account', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Account;
    },
    enabled: !!user && !!id,
  });

  const { data: transactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ['account-transactions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`account_id.eq.${id},source_account_id.eq.${id},destination_account_id.eq.${id}`)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user && !!id,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*');
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories?.find(c => c.id === categoryId)?.name || null;
  };

  // Filter transactions
  const filteredTransactions = transactions?.filter(t => {
    let typeMatch = true;
    let monthMatch = true;

    if (filterType !== 'all') {
      typeMatch = t.transaction_type === filterType;
    }

    if (filterMonth !== 'all') {
      const txMonth = format(new Date(t.transaction_date), 'yyyy-MM');
      monthMatch = txMonth === filterMonth;
    }

    return typeMatch && monthMatch;
  });

  // Get unique months from transactions
  const months = [...new Set(transactions?.map(t => 
    format(new Date(t.transaction_date), 'yyyy-MM')
  ))].sort().reverse();

  // Calculate filtered totals
  const filteredIncome = filteredTransactions
    ?.filter(t => t.transaction_type === 'income' || 
      (t.transaction_type === 'transfer' && t.destination_account_id === id))
    .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  const filteredExpense = filteredTransactions
    ?.filter(t => t.transaction_type === 'expense' || 
      (t.transaction_type === 'transfer' && t.source_account_id === id))
    .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  if (loadingAccount || loadingTransactions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Cuenta no encontrada" showBack />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title={account.name}
        subtitle={account.alias || undefined}
        showBack
        action={
          <div className="flex gap-2">
            <Link to={`/accounts/${id}/edit`}>
              <Button size="icon" variant="outline" className="rounded-full">
                <Pencil className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/transactions/new">
              <Button size="icon" className="rounded-full">
                <Plus className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        {/* Balance Card */}
        <Card 
          className="glass border-border/50"
          style={{ borderLeftColor: account.color || '#6366f1', borderLeftWidth: '4px' }}
        >
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Balance actual</p>
            <CurrencyDisplay 
              amount={Number(account.current_balance)} 
              currency={account.currency}
              size="xl"
            />
            
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/50">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Ingresos (filtrados)</p>
                <CurrencyDisplay 
                  amount={filteredIncome} 
                  currency={account.currency}
                  size="sm"
                  className="text-income"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Egresos (filtrados)</p>
                <CurrencyDisplay 
                  amount={filteredExpense} 
                  currency={account.currency}
                  size="sm"
                  className="text-expense"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="flex-1">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="income">Ingresos</SelectItem>
              <SelectItem value="expense">Egresos</SelectItem>
              <SelectItem value="transfer">Transferencias</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los meses</SelectItem>
              {months.map(month => (
                <SelectItem key={month} value={month}>
                  {format(new Date(month + '-01'), 'MMMM yyyy', { locale: es })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Transactions List */}
        {(!filteredTransactions || filteredTransactions.length === 0) ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="Sin movimientos"
            description="No hay movimientos que coincidan con los filtros"
          />
        ) : (
          <div className="space-y-2">
            {filteredTransactions.map((transaction) => {
              const isIncoming = 
                transaction.transaction_type === 'income' ||
                (transaction.transaction_type === 'transfer' && transaction.destination_account_id === id);
              
              const isOutgoing = 
                transaction.transaction_type === 'expense' ||
                (transaction.transaction_type === 'transfer' && transaction.source_account_id === id);

              return (
                <Card key={transaction.id} className="glass border-border/50">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-2 ${
                        isIncoming ? 'bg-income/10' : 
                        isOutgoing ? 'bg-expense/10' : 
                        'bg-transfer/10'
                      }`}>
                        {isIncoming ? (
                          <TrendingUp className="h-4 w-4 text-income" />
                        ) : isOutgoing ? (
                          <TrendingDown className="h-4 w-4 text-expense" />
                        ) : (
                          <ArrowLeftRight className="h-4 w-4 text-transfer" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {transaction.description || 'Sin descripción'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {format(new Date(transaction.transaction_date), 'd MMM yyyy', { locale: es })}
                          </span>
                          {getCategoryName(transaction.category_id) && (
                            <>
                              <span>•</span>
                              <span>{getCategoryName(transaction.category_id)}</span>
                            </>
                          )}
                          {transaction.has_installments && (
                            <>
                              <span>•</span>
                              <span className="text-primary">
                                Cuota {transaction.current_installment}/{transaction.total_installments}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <CurrencyDisplay 
                      amount={Number(transaction.amount)} 
                      currency={transaction.currency}
                      size="sm"
                      className={isIncoming ? 'text-income' : isOutgoing ? 'text-expense' : ''}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
