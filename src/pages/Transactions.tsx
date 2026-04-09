import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Search,
  Check,
  CreditCard,
  Calendar,
  Repeat,
  ShoppingBag,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatRelativeDate, getMonthName } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import type { Transaction, Installment, RecurringExpense } from '@/types/finance';
import { INSTALLMENT_STATUS_LABELS } from '@/types/finance';

type TransactionWithRelations = Transaction & {
  account: { name: string; color: string } | null;
  category: { name: string; icon: string; color: string } | null;
};

export default function Transactions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [tab, setTab] = useState('realized');

  // === REALIZADOS ===
  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          account:accounts!transactions_account_id_fkey(name, color),
          category:categories!transactions_category_id_fkey(name, icon, color)
        `)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as TransactionWithRelations[];
    },
    enabled: !!user,
  });

  // === PROGRAMADOS: cuotas futuras ===
  const { data: futureInstallments = [], isLoading: loadingInst } = useQuery({
    queryKey: ['installments', 'future'],
    queryFn: async () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const { data, error } = await supabase
        .from('installments')
        .select('*, purchase:purchases(description, merchant, card_account_id, original_currency, installments_count)')
        .eq('user_id', user!.id)
        .in('status', ['pending', 'billed'])
        .order('billing_year')
        .order('billing_month');
      if (error) throw error;
      return (data as (Installment & {
        purchase: { description: string; merchant: string | null; card_account_id: string; original_currency: string; installments_count: number };
      })[]).filter((i) => {
        // Solo futuras (mes actual incluido como "billed")
        return i.billing_year > currentYear || (i.billing_year === currentYear && i.billing_month >= currentMonth);
      });
    },
    enabled: !!user && tab === 'scheduled',
  });

  // === PROGRAMADOS: recurrentes pendientes ===
  const { data: recurringExpenses = [], isLoading: loadingRec } = useQuery({
    queryKey: ['recurring-expenses', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*, category:categories(name, icon, color)')
        .eq('is_active', true)
        .order('next_due_date');
      if (error) throw error;
      return data as (RecurringExpense & { category: { name: string; icon: string; color: string } | null })[];
    },
    enabled: !!user && tab === 'scheduled',
  });

  // Toggle verificación
  const verifyMutation = useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      const { error } = await supabase
        .from('transactions')
        .update({
          is_verified: verified,
          verified_at: verified ? new Date().toISOString() : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: () => {
      toast({ title: 'Error al verificar', variant: 'destructive' });
    },
  });

  // Filtrar realizados
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const typeMatch = filterType === 'all' || t.transaction_type === filterType;
      const searchMatch =
        !search ||
        t.description?.toLowerCase().includes(search.toLowerCase()) ||
        t.category?.name.toLowerCase().includes(search.toLowerCase()) ||
        t.account?.name.toLowerCase().includes(search.toLowerCase());
      return typeMatch && searchMatch;
    });
  }, [transactions, filterType, search]);

  // Agrupar por fecha
  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce(
      (groups, tx) => {
        const date = tx.transaction_date;
        if (!groups[date]) groups[date] = [];
        groups[date].push(tx);
        return groups;
      },
      {} as Record<string, TransactionWithRelations[]>,
    );
  }, [filteredTransactions]);

  const isLoading = loadingTx || (tab === 'scheduled' && (loadingInst || loadingRec));

  if (isLoading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const typeIcon = (type: string) => {
    if (type === 'income') return <TrendingUp className="h-4 w-4 text-income" />;
    if (type === 'expense') return <TrendingDown className="h-4 w-4 text-expense" />;
    return <ArrowLeftRight className="h-4 w-4 text-warning" />;
  };

  const typeBg = (type: string) => {
    if (type === 'income') return 'bg-income/10';
    if (type === 'expense') return 'bg-expense/10';
    return 'bg-warning/10';
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Movimientos"
        subtitle="Historial y programados"
        action={
          <div className="flex gap-2">
            <Link to="/transactions/new?type=expense">
              <Button size="sm" className="bg-expense hover:bg-expense/90 rounded-full">
                <TrendingDown className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Egreso</span>
              </Button>
            </Link>
            <Link to="/transactions/new?type=income">
              <Button size="sm" className="bg-income hover:bg-income/90 rounded-full">
                <TrendingUp className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Ingreso</span>
              </Button>
            </Link>
            <Link to="/transactions/new?type=transfer">
              <Button size="sm" variant="outline" className="rounded-full">
                <ArrowLeftRight className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Transf.</span>
              </Button>
            </Link>
            <Link to="/purchases/new">
              <Button size="sm" variant="outline" className="rounded-full border-primary/50 text-primary">
                <ShoppingBag className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Cuotas</span>
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="realized" className="flex-1 sm:flex-none">Realizados</TabsTrigger>
              <TabsTrigger value="scheduled" className="flex-1 sm:flex-none">Programados</TabsTrigger>
            </TabsList>

            {/* === TAB REALIZADOS === */}
            <TabsContent value="realized" className="mt-4 space-y-4">
              {/* Barra de filtros */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por descripción, categoría o cuenta..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto">
                  {[
                    { value: 'all', label: 'Todos' },
                    { value: 'income', label: 'Ingresos' },
                    { value: 'expense', label: 'Egresos' },
                    { value: 'transfer', label: 'Transf.' },
                  ].map((f) => (
                    <Button
                      key={f.value}
                      variant={filterType === f.value ? 'default' : 'outline'}
                      size="sm"
                      className="rounded-full whitespace-nowrap"
                      onClick={() => setFilterType(f.value)}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Lista agrupada por día */}
              {filteredTransactions.length === 0 ? (
                <EmptyState
                  icon={ArrowLeftRight}
                  title="Sin movimientos"
                  description="Registra tu primer ingreso o egreso para comenzar"
                  action={
                    <Link to="/transactions/new">
                      <Button><Plus className="h-4 w-4 mr-2" /> Nuevo movimiento</Button>
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedTransactions).map(([date, dayTxs]) => (
                    <div key={date}>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
                        {formatRelativeDate(date)}
                      </p>
                      <div className="space-y-1.5">
                        {dayTxs.map((tx) => (
                          <Card key={tx.id} className="border-border/50 hover:border-primary/50 transition-colors">
                            <CardContent className="p-3 flex items-center gap-3">
                              {/* Verificación */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  verifyMutation.mutate({ id: tx.id, verified: !tx.is_verified });
                                }}
                                className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  tx.is_verified
                                    ? 'bg-income border-income text-white'
                                    : 'border-muted-foreground/30 hover:border-primary'
                                }`}
                                title={tx.is_verified ? 'Verificado' : 'Marcar como verificado'}
                              >
                                {tx.is_verified && <Check className="h-3 w-3" />}
                              </button>

                              {/* Ícono tipo */}
                              <div className={`rounded-full p-2 shrink-0 ${typeBg(tx.transaction_type)}`}>
                                {typeIcon(tx.transaction_type)}
                              </div>

                              {/* Info */}
                              <Link to={`/transactions/${tx.id}`} className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {tx.description || tx.category?.name || 'Sin descripción'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {tx.account?.name || 'Sin cuenta'}
                                  {tx.category && ` · ${tx.category.name}`}
                                </p>
                              </Link>

                              {/* Monto */}
                              <div className="shrink-0 text-right">
                                <CurrencyDisplay
                                  amount={Number(tx.amount)}
                                  currency={tx.currency}
                                  showSign
                                  isExpense={tx.transaction_type === 'expense'}
                                  size="sm"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* === TAB PROGRAMADOS === */}
            <TabsContent value="scheduled" className="mt-4 space-y-6">
              {/* Cuotas futuras */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Cuotas de tarjeta
                  </h3>
                  <Badge variant="outline" className="text-xs">{futureInstallments.length}</Badge>
                </div>

                {futureInstallments.length === 0 ? (
                  <Card className="border-border/50">
                    <CardContent className="p-4 text-center text-sm text-muted-foreground">
                      No hay cuotas pendientes.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-1.5">
                    {futureInstallments.slice(0, 20).map((inst) => (
                      <Card key={inst.id} className="border-border/50">
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="rounded-full p-2 bg-primary/10 shrink-0">
                            <CreditCard className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {inst.purchase?.description ?? 'Compra'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {inst.purchase?.merchant && `${inst.purchase.merchant} · `}
                              Cuota {inst.installment_number}/{inst.purchase?.installments_count ?? '?'} ·{' '}
                              {getMonthName(inst.billing_month).slice(0, 3)} {inst.billing_year}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {INSTALLMENT_STATUS_LABELS[inst.status]}
                          </Badge>
                          <CurrencyDisplay
                            amount={Number(inst.amount_ars ?? inst.amount_original)}
                            currency={(inst.purchase?.original_currency as 'ARS' | 'USD') ?? 'ARS'}
                            size="sm"
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Recurrentes esperados */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Repeat className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Gastos recurrentes activos
                  </h3>
                  <Badge variant="outline" className="text-xs">{recurringExpenses.length}</Badge>
                </div>

                {recurringExpenses.length === 0 ? (
                  <Card className="border-border/50">
                    <CardContent className="p-4 text-center text-sm text-muted-foreground">
                      No hay gastos recurrentes activos.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-1.5">
                    {recurringExpenses.map((rec) => (
                      <Card key={rec.id} className="border-border/50">
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="rounded-full p-2 bg-warning/10 shrink-0">
                            <Repeat className="h-4 w-4 text-warning" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{rec.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {rec.category?.name ?? 'Sin categoría'} · Próximo: {formatRelativeDate(rec.next_due_date)}
                            </p>
                          </div>
                          <CurrencyDisplay
                            amount={Number(rec.amount)}
                            currency={rec.currency}
                            size="sm"
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
