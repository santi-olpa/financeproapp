import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Plus, 
  Repeat, 
  Edit, 
  Trash2, 
  Calendar, 
  TrendingDown,
  History,
  DollarSign,
  Play,
  Loader2,
  CreditCard,
  X,
  Wallet,
  Download
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { RecurringExpense, Category, Account, Currency, RecurringFrequency, PriceHistoryEntry, Transaction } from '@/types/finance';
import { FREQUENCY_LABELS, CURRENCY_SYMBOLS } from '@/types/finance';
import { getMonthName, getCurrentPeriod } from '@/lib/format';
import { PeriodSelector } from '@/components/reports/PeriodSelector';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, ChevronLeft, ChevronRight } from 'lucide-react';

export default function RecurringExpenses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
  const [isPriceUpdateOpen, setIsPriceUpdateOpen] = useState(false);
  const [selectedExpenseForUpdate, setSelectedExpenseForUpdate] = useState<RecurringExpense | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const currentPeriod = getCurrentPeriod();
  const [month, setMonth] = useState(currentPeriod.month);
  const [year, setYear] = useState(currentPeriod.year);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Delete transaction mutation
  const deleteTransactionMutation = useMutation({
    mutationFn: async (tx: Transaction) => {
      const accountId = tx.account_id;
      const { error } = await supabase.from('transactions').delete().eq('id', tx.id);
      if (error) throw error;
      // Recalculate account balance from DB
      if (accountId) {
        await supabase.rpc('recalculate_account_balance', { p_account_id: accountId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Movimiento eliminado');
    },
    onError: () => toast.error('Error al eliminar el movimiento'),
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    currency: 'ARS' as Currency,
    category_id: '',
    account_id: '',
    frequency: 'monthly' as RecurringFrequency,
    start_date: format(new Date(), 'yyyy-MM-dd'),
    next_due_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  const [priceUpdateData, setPriceUpdateData] = useState({
    amount: '',
    effective_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  // Fetch recurring expenses
  const { data: recurringExpenses, isLoading } = useQuery({
    queryKey: ['recurring-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select(`*, category:categories(*), account:accounts(*)`)
        .order('next_due_date', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        price_history: (item.price_history as unknown as PriceHistoryEntry[]) || []
      })) as unknown as RecurringExpense[];
    },
    enabled: !!user,
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories', 'expense'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('category_type', 'expense')
        .order('name');
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Account[];
    },
    enabled: !!user,
  });

  // Fetch current month transactions
  const { data: monthlyTransactions } = useQuery({
    queryKey: ['transactions', 'expense', month, year],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`*, category:categories(*), account:accounts!transactions_account_id_fkey(name, color, current_balance)`)
        .eq('transaction_type', 'expense')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      return data as unknown as Transaction[];
    },
    enabled: !!user,
  });

  // Fetch installment transactions for selected month
  const { data: installmentTransactions } = useQuery({
    queryKey: ['transactions', 'installments', month, year],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`*, category:categories(*), account:accounts!transactions_account_id_fkey(name, color)`)
        .eq('transaction_type', 'expense')
        .eq('has_installments', true)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      return data as unknown as (Transaction & { account: { name: string; color: string } | null })[];
    },
    enabled: !!user,
  });

  // Fetch ALL installment transactions for progress tracking (to know total paid across all months)
  const { data: allInstallmentTransactions } = useQuery({
    queryKey: ['transactions', 'all-installments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('description, current_installment, total_installments, transaction_date, amount, currency')
        .eq('transaction_type', 'expense')
        .eq('has_installments', true)
        .order('transaction_date', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const initialPriceHistory = [{ amount: parseFloat(data.amount), effective_date: data.start_date, notes: 'Precio inicial' }];
      const payload = {
        user_id: user!.id,
        name: data.name,
        description: data.description || null,
        amount: parseFloat(data.amount),
        currency: data.currency,
        category_id: data.category_id || null,
        account_id: data.account_id || null,
        frequency: data.frequency,
        start_date: data.start_date,
        next_due_date: data.next_due_date,
        notes: data.notes || null,
        price_history: initialPriceHistory as unknown as Record<string, unknown>[]
      };

      if (editingExpense) {
        const { error } = await supabase
          .from('recurring_expenses')
          .update({ name: payload.name, description: payload.description, category_id: payload.category_id, account_id: payload.account_id, frequency: payload.frequency, next_due_date: payload.next_due_date, notes: payload.notes })
          .eq('id', editingExpense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('recurring_expenses').insert([payload] as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      setIsDialogOpen(false);
      setEditingExpense(null);
      resetForm();
      toast.success(editingExpense ? 'Gasto recurrente actualizado' : 'Gasto recurrente creado');
    },
    onError: () => toast.error('Error al guardar'),
  });

  const updatePriceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedExpenseForUpdate) return;
      const newEntry: PriceHistoryEntry = { amount: parseFloat(priceUpdateData.amount), effective_date: priceUpdateData.effective_date, notes: priceUpdateData.notes || undefined };
      const updatedHistory = [...(selectedExpenseForUpdate.price_history || []), newEntry];
      const { error } = await supabase.from('recurring_expenses').update({ amount: parseFloat(priceUpdateData.amount), price_history: updatedHistory as any }).eq('id', selectedExpenseForUpdate.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      setIsPriceUpdateOpen(false);
      setSelectedExpenseForUpdate(null);
      setPriceUpdateData({ amount: '', effective_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
      toast.success('Precio actualizado');
    },
    onError: () => toast.error('Error al actualizar precio'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('recurring_expenses').update({ is_active, end_date: is_active ? null : format(new Date(), 'yyyy-MM-dd') }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      toast.success('Estado actualizado');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      toast.success('Gasto recurrente eliminado');
    },
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', amount: '', currency: 'ARS', category_id: '', account_id: '', frequency: 'monthly', start_date: format(new Date(), 'yyyy-MM-dd'), next_due_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
  };

  const handleProcessRecurring = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-recurring-expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error processing');
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      if (result.processed === 0) toast.info('No hay gastos vencidos para procesar');
      else toast.success(`Se procesaron ${result.processed} gastos recurrentes`);
    } catch (error) {
      toast.error('Error al procesar gastos recurrentes');
    } finally {
      setIsProcessing(false);
    }
  };

  const openEdit = (expense: RecurringExpense) => {
    setEditingExpense(expense);
    setFormData({ name: expense.name, description: expense.description || '', amount: String(expense.amount), currency: expense.currency, category_id: expense.category_id || '', account_id: expense.account_id || '', frequency: expense.frequency, start_date: expense.start_date, next_due_date: expense.next_due_date, notes: expense.notes || '' });
    setIsDialogOpen(true);
  };

  const openPriceUpdate = (expense: RecurringExpense) => {
    setSelectedExpenseForUpdate(expense);
    setPriceUpdateData({ amount: String(expense.amount), effective_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    setIsPriceUpdateOpen(true);
  };

  // Calculations
  const projectedRecurringTotal = recurringExpenses?.filter(e => e.is_active && e.currency === 'ARS').reduce((sum, expense) => {
    const multiplier = expense.frequency === 'weekly' ? 4 : expense.frequency === 'biweekly' ? 2 : expense.frequency === 'monthly' ? 1 : expense.frequency === 'quarterly' ? 0.33 : 0.083;
    return sum + (Number(expense.amount) * multiplier);
  }, 0) ?? 0;

  // Filter by ARS only for the summary (consistent with Reports module)
  const arsMonthlyTransactions = monthlyTransactions?.filter(tx => tx.currency === 'ARS') ?? [];
  const totalMonthlyExpenses = arsMonthlyTransactions.reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
  const expensesByCategory = arsMonthlyTransactions.reduce((acc, tx) => {
    const categoryName = tx.category?.name || 'Sin categoría';
    if (!acc[categoryName]) acc[categoryName] = { total: 0, color: tx.category?.color || '#6b7280' };
    acc[categoryName].total += Math.abs(Number(tx.amount));
    return acc;
  }, {} as Record<string, { total: number; color: string }>);

  // Cuotas tarjetas: only installments that are part of the month's expenses (already included in totalMonthlyExpenses)
  const cuotasTarjetasTotal = installmentTransactions?.filter(tx => tx.currency === 'ARS').reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0) ?? 0;

  // Helper: get base purchase name by removing "(X/Y)" suffix
  const getBaseName = (desc: string | null) => {
    if (!desc) return 'Sin descripción';
    return desc.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim() || desc;
  };

  // Helper: find how many cuotas of this purchase are already paid (past months + current)
  const getPurchaseProgress = (tx: Transaction) => {
    const baseName = getBaseName(tx.description);
    const total = tx.total_installments || 1;
    // Count how many transactions with same base name exist up to selected month
    const paidCount = allInstallmentTransactions?.filter(t => {
      const tBaseName = getBaseName(t.description);
      const tDate = new Date(t.transaction_date);
      const isBeforeOrCurrentMonth = tDate.getFullYear() < year || 
        (tDate.getFullYear() === year && tDate.getMonth() + 1 <= month);
      return tBaseName === baseName && t.total_installments === total && isBeforeOrCurrentMonth;
    }).length ?? 0;
    return { paidCount, total, baseName };
  };

  // Export expenses to CSV
  const handleExportCSV = () => {
    const allExpenses: { fecha: string; descripcion: string; categoria: string; cuenta: string; tipo: string; monto: number; moneda: string }[] = [];

    // Regular monthly expenses
    (monthlyTransactions ?? []).forEach(tx => {
      allExpenses.push({
        fecha: tx.transaction_date,
        descripcion: tx.description || 'Sin descripción',
        categoria: tx.category?.name || 'Sin categoría',
        cuenta: (tx as any).account?.name || 'Sin cuenta',
        tipo: tx.has_installments ? `Cuota ${tx.current_installment || '-'}/${tx.total_installments || '-'}` : 'Gasto',
        monto: Number(tx.amount),
        moneda: tx.currency,
      });
    });

    // Active recurring expenses (projected)
    (recurringExpenses ?? []).filter(e => e.is_active).forEach(exp => {
      const alreadyInTx = (monthlyTransactions ?? []).some(tx => tx.recurring_expense_id === exp.id);
      if (!alreadyInTx) {
        allExpenses.push({
          fecha: exp.next_due_date,
          descripcion: exp.name,
          categoria: exp.category?.name || 'Sin categoría',
          cuenta: exp.account?.name || 'Sin cuenta',
          tipo: `Recurrente (${FREQUENCY_LABELS[exp.frequency]})`,
          monto: Number(exp.amount),
          moneda: exp.currency,
        });
      }
    });

    if (allExpenses.length === 0) {
      toast.info('No hay datos para exportar');
      return;
    }

    allExpenses.sort((a, b) => b.fecha.localeCompare(a.fecha));

    const header = 'Fecha,Descripción,Categoría,Cuenta,Tipo,Monto,Moneda';
    const rows = allExpenses.map(e =>
      `${e.fecha},"${e.descripcion.replace(/"/g, '""')}","${e.categoria}","${e.cuenta}","${e.tipo}",${e.monto},${e.moneda}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gastos_${getMonthName(month)}_${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Archivo exportado');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4 space-y-4">
          <PeriodSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
        <Tabs defaultValue="monthly" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="monthly">Gastos</TabsTrigger>
              <TabsTrigger value="recurring">Recurrentes</TabsTrigger>
              <TabsTrigger value="cards">Cuotas</TabsTrigger>
            </TabsList>

            <TabsContent value="monthly" className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={() => navigate('/transactions/new?type=expense')} className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Gasto
                </Button>
                <Button variant="outline" onClick={handleProcessRecurring} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                </Button>
              </div>

              <Card className="glass border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{getMonthName(month)} {year}</p>
                      <p className="text-2xl font-bold text-expense">
                        <CurrencyDisplay amount={totalMonthlyExpenses} currency="ARS" size="xl" />
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Recurrentes proyectados</p>
                      <p className="text-lg font-semibold text-muted-foreground">
                        ~ <CurrencyDisplay amount={projectedRecurringTotal} currency="ARS" size="md" />
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Category breakdown */}
              {Object.keys(expensesByCategory).length > 0 && (
                <Card className="glass border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold">Gasto por Categoría</h4>
                      {selectedCategory && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setSelectedCategory(null)}>
                          <X className="h-3 w-3 mr-1" /> Quitar filtro
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {Object.entries(expensesByCategory)
                        .sort(([, a], [, b]) => b.total - a.total)
                        .map(([catName, { total, color }]) => {
                          const pct = totalMonthlyExpenses > 0 ? Math.round((total / totalMonthlyExpenses) * 100) : 0;
                          const isSelected = selectedCategory === catName;
                          return (
                            <button
                              key={catName}
                              className={`w-full text-left rounded-lg p-2 transition-colors ${isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50'}`}
                              onClick={() => setSelectedCategory(isSelected ? null : catName)}
                            >
                              <div className="flex justify-between text-sm mb-1">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                  <span className="truncate max-w-[140px]">{catName}</span>
                                </span>
                                <span className="text-muted-foreground">{pct}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                              </div>
                              <p className="text-xs text-muted-foreground text-right mt-0.5">
                                <CurrencyDisplay amount={total} currency="ARS" size="sm" />
                              </p>
                            </button>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedCategory && (
                <div className="flex items-center gap-2 py-2">
                  <Badge variant="secondary" className="gap-1">
                    Filtro: {selectedCategory}
                    <button onClick={() => setSelectedCategory(null)}><X className="h-3 w-3" /></button>
                  </Badge>
                </div>
              )}

              <div className="space-y-2">
                {(() => {
                  const filtered = (monthlyTransactions ?? []).filter(tx => 
                    !selectedCategory || (tx.category?.name || 'Sin categoría') === selectedCategory
                  );
                  return filtered.length === 0 ? (
                    <EmptyState icon={TrendingDown} title="Sin gastos" description={selectedCategory ? `No hay gastos en "${selectedCategory}" este mes` : "No hay gastos registrados este mes"} />
                  ) : (
                    filtered.map((tx) => (
                    <Card key={tx.id} className="glass border-border/50">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: tx.category?.color || '#6b7280' }} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{tx.description || 'Sin descripción'}</p>
                              <p className="text-xs text-muted-foreground">{tx.category?.name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(tx.transaction_date), 'd MMM', { locale: es })}
                                </span>
                                {(tx as any).account?.name && (
                                  <span className="flex items-center gap-1">
                                    <Wallet className="h-3 w-3" />
                                    {(tx as any).account.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <CurrencyDisplay amount={Number(tx.amount)} currency={tx.currency} size="sm" className="text-expense" />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/transactions/${tx.id}/edit`)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
                                  <AlertDialogDescription>Esta acción no se puede deshacer. El saldo de la cuenta será revertido.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteTransactionMutation.mutate(tx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                  );
                })()}
              </div>
            </TabsContent>

            <TabsContent value="recurring" className="space-y-4">
              <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingExpense(null); resetForm(); } }}>
                <DialogTrigger asChild>
                  <Button className="w-full"><Plus className="h-4 w-4 mr-2" />Nuevo Recurrente</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{editingExpense ? 'Editar' : 'Nuevo'} Gasto Recurrente</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-4">
                    <div><Label>Nombre</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Monto</Label><Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required disabled={!!editingExpense} /></div>
                      <div><Label>Moneda</Label><Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v as Currency })} disabled={!!editingExpense}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">ARS</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
                    </div>
                    <div><Label>Frecuencia</Label><Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v as RecurringFrequency })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FREQUENCY_LABELS).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent></Select></div>
                    <div><Label>Categoría</Label><Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{categories?.map((cat) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}</SelectContent></Select></div>
                    <div><Label>Cuenta</Label><Select value={formData.account_id} onValueChange={(v) => setFormData({ ...formData, account_id: v })}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{accounts?.map((acc) => (<SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>))}</SelectContent></Select></div>
                    <div><Label>Próximo vencimiento</Label><Input type="date" value={formData.next_due_date} onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })} required /></div>
                    <Button type="submit" className="w-full" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Guardando...' : 'Guardar'}</Button>
                  </form>
                </DialogContent>
              </Dialog>

              {(!recurringExpenses || recurringExpenses.length === 0) ? (
                <EmptyState icon={Repeat} title="Sin gastos recurrentes" description="Agrega tus gastos fijos" />
              ) : (
                <div className="space-y-3">
                  {recurringExpenses.map((expense) => (
                    <Card key={expense.id} className={`glass border-border/50 ${!expense.is_active ? 'opacity-50' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium">{expense.name}</h3>
                              <Badge variant={expense.is_active ? 'default' : 'secondary'} className="text-xs">{expense.is_active ? FREQUENCY_LABELS[expense.frequency] : 'Inactivo'}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{expense.category?.name}</p>
                          </div>
                          <CurrencyDisplay amount={Number(expense.amount)} currency={expense.currency} size="lg" className="text-expense" />
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-border/50">
                          <Switch checked={expense.is_active} onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: expense.id, is_active: checked })} />
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPriceUpdate(expense)}><DollarSign className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(expense)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm('¿Eliminar?')) deleteMutation.mutate(expense.id); }}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="cards" className="space-y-3">
              {(!installmentTransactions || installmentTransactions.length === 0) ? (
                <EmptyState icon={CreditCard} title="Sin cuotas este mes" description={`No hay cuotas programadas para ${getMonthName(month)}`} />
              ) : (
                installmentTransactions.map((tx) => {
                  const { paidCount, total, baseName } = getPurchaseProgress(tx);
                  const progress = total > 0 ? Math.round((paidCount / total) * 100) : 0;
                  const isFullyPaid = paidCount >= total;
                  const currentInstallment = tx.current_installment || 1;
                  
                  return (
                    <Card key={tx.id} className="glass border-border/50" onClick={() => navigate(`/transactions/${tx.id}`)}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-warning" />
                            <span className="font-medium text-sm truncate">{baseName}</span>
                          </div>
                          <Badge variant={isFullyPaid ? 'default' : 'secondary'} className={`text-xs ${isFullyPaid ? 'bg-income/10 text-income' : ''}`}>
                            Cuota {currentInstallment}/{total}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                          <span>{tx.account?.name || 'Sin cuenta'} • {tx.category?.name || ''}</span>
                          <CurrencyDisplay amount={Number(tx.amount)} currency={tx.currency} size="sm" className="font-semibold text-foreground" />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{paidCount}/{total}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </div>

        <Dialog open={isPriceUpdateOpen} onOpenChange={setIsPriceUpdateOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Actualizar Precio</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nuevo monto</Label><Input type="number" value={priceUpdateData.amount} onChange={(e) => setPriceUpdateData({ ...priceUpdateData, amount: e.target.value })} /></div>
              <div><Label>Fecha efectiva</Label><Input type="date" value={priceUpdateData.effective_date} onChange={(e) => setPriceUpdateData({ ...priceUpdateData, effective_date: e.target.value })} /></div>
              <Button onClick={() => updatePriceMutation.mutate()} className="w-full" disabled={updatePriceMutation.isPending}>Actualizar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Desktop Layout - Like HTML template (gastos.html)
  return (
    <div className="min-h-screen bg-background">
       <PageHeader 
        title="Gestión de Gastos" 
        subtitle="Control y proyección de egresos"
        action={
          <PeriodSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
        }
      />

      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Metrics Grid - 4 columns like template */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="glass border-border/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase mb-1">Gastos Ejecutados</p>
                <h3 className="text-xl font-extrabold text-expense">
                  <CurrencyDisplay amount={totalMonthlyExpenses} currency="ARS" size="xl" className="text-expense" />
                </h3>
              </CardContent>
            </Card>
            <Card className="glass border-border/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase mb-1">Proyección Recurrente</p>
                <h3 className="text-xl font-extrabold text-warning">
                  <CurrencyDisplay amount={projectedRecurringTotal} currency="ARS" size="xl" className="text-warning" />
                </h3>
              </CardContent>
            </Card>
            <Card className="glass border-border/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase mb-1">Cuotas Tarjetas</p>
                <h3 className="text-xl font-extrabold text-warning">
                  <CurrencyDisplay amount={cuotasTarjetasTotal} currency="ARS" size="xl" className="text-warning" />
                </h3>
              </CardContent>
            </Card>
            <Card className="glass border-border/50 bg-gradient-to-br from-card to-primary/10">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase mb-1">Total Comprometido</p>
                <h3 className="text-xl font-extrabold">
                  <CurrencyDisplay amount={totalMonthlyExpenses + projectedRecurringTotal} currency="ARS" size="xl" />
                </h3>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="history" className="w-full">
            <TabsList className="border-b border-border bg-transparent mb-6">
              <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Historial del Mes</TabsTrigger>
              <TabsTrigger value="recurring" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Gastos Recurrentes</TabsTrigger>
              <TabsTrigger value="cards" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Tarjetas / Cuotas</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button onClick={() => navigate('/transactions/new?type=expense')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Gasto
                </Button>
              </div>

              {/* Category breakdown desktop */}
              {Object.keys(expensesByCategory).length > 0 && (
                <Card className="glass border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold">Gasto por Categoría — {getMonthName(month)} {year}</h4>
                      {selectedCategory && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelectedCategory(null)}>
                          <X className="h-3 w-3 mr-1" /> Quitar filtro
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {Object.entries(expensesByCategory)
                        .sort(([, a], [, b]) => b.total - a.total)
                        .map(([catName, { total, color }]) => {
                          const pct = totalMonthlyExpenses > 0 ? Math.round((total / totalMonthlyExpenses) * 100) : 0;
                          const isSelected = selectedCategory === catName;
                          return (
                            <button
                              key={catName}
                              className={`p-3 rounded-lg text-left transition-colors ${isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted/30 hover:bg-muted/50'}`}
                              onClick={() => setSelectedCategory(isSelected ? null : catName)}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                <span className="text-sm font-medium truncate">{catName}</span>
                              </div>
                              <p className="text-lg font-bold">
                                <CurrencyDisplay amount={total} currency="ARS" size="md" />
                              </p>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{pct}%</p>
                            </button>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedCategory && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1 text-sm">
                    Mostrando: {selectedCategory}
                    <button onClick={() => setSelectedCategory(null)}><X className="h-3 w-3 ml-1" /></button>
                  </Badge>
                </div>
              )}
              
              <div className="space-y-2">
                {(() => {
                  const filtered = (monthlyTransactions ?? []).filter(tx =>
                    !selectedCategory || (tx.category?.name || 'Sin categoría') === selectedCategory
                  );
                  return filtered.length === 0 ? (
                    <EmptyState icon={TrendingDown} title="Sin gastos" description={selectedCategory ? `No hay gastos en "${selectedCategory}" este mes` : "No hay gastos registrados este mes"} />
                  ) : filtered.map((tx) => (
                    <Card key={tx.id} className="glass border-border/50">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-[45px_2fr_1fr_1fr_1fr_150px] items-center gap-4">
                          <div className="w-9 h-9 rounded-xl bg-expense/10 flex items-center justify-center">
                            <TrendingDown className="h-4 w-4 text-expense" />
                          </div>
                          <div>
                            <h4 className="font-medium">{tx.description || 'Sin descripción'}</h4>
                            <p className="text-sm text-muted-foreground">{tx.notes || ''}</p>
                          </div>
                          <div className="text-sm">
                            <p className="text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(tx.transaction_date), 'd MMM yyyy', { locale: es })}
                            </p>
                            <p className="text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Wallet className="h-3.5 w-3.5" />
                              {(tx as any).account?.name || 'Sin cuenta'}
                            </p>
                          </div>
                          <Badge variant="secondary" className="w-fit">{tx.category?.name || 'Sin categoría'}</Badge>
                          <div className="text-right font-bold">
                            <CurrencyDisplay amount={Number(tx.amount)} currency={tx.currency} size="md" className="text-expense" />
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/transactions/${tx.id}/edit`)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
                                  <AlertDialogDescription>Esta acción no se puede deshacer. El saldo de la cuenta será revertido.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteTransactionMutation.mutate(tx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ));
                })()}
              </div>
            </TabsContent>

            <TabsContent value="recurring" className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingExpense(null); resetForm(); } }}>
                  <DialogTrigger asChild>
                    <Button><Plus className="h-4 w-4 mr-2" />Nuevo Gasto / Recurrente</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editingExpense ? 'Editar' : 'Nuevo'} Gasto Recurrente</DialogTitle></DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-4">
                      <div><Label>Nombre</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Netflix, Alquiler" required /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Monto</Label><Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required disabled={!!editingExpense} /></div>
                        <div><Label>Moneda</Label><Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v as Currency })} disabled={!!editingExpense}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">ARS</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
                      </div>
                      <div><Label>Frecuencia</Label><Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v as RecurringFrequency })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FREQUENCY_LABELS).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent></Select></div>
                      <div><Label>Categoría</Label><Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{categories?.map((cat) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}</SelectContent></Select></div>
                      <div><Label>Cuenta de débito</Label><Select value={formData.account_id} onValueChange={(v) => setFormData({ ...formData, account_id: v })}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{accounts?.map((acc) => (<SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</SelectItem>))}</SelectContent></Select></div>
                      <div><Label>Próximo vencimiento</Label><Input type="date" value={formData.next_due_date} onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })} required /></div>
                      <Button type="submit" className="w-full" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Guardando...' : 'Guardar'}</Button>
                    </form>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" onClick={handleProcessRecurring} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Procesar Vencidos
                </Button>
              </div>

              <div className="space-y-2">
                {(!recurringExpenses || recurringExpenses.length === 0) ? (
                  <EmptyState icon={Repeat} title="Sin gastos recurrentes" description="Agrega tus gastos fijos" />
                ) : (
                  recurringExpenses.map((expense) => (
                    <Card key={expense.id} className={`glass border-border/50 ${!expense.is_active ? 'opacity-50' : ''} ${!expense.is_active ? 'border-dashed' : ''}`}>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-[45px_2fr_1fr_1fr_150px] items-center gap-4">
                          <div className="w-9 h-9 rounded-xl bg-secondary/50 flex items-center justify-center">
                            <Repeat className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="font-medium">{expense.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Vence el {format(new Date(expense.next_due_date), 'd', { locale: es })} • {expense.account?.name || 'Sin cuenta'}
                            </p>
                          </div>
                          <Badge variant={expense.is_active ? 'default' : 'secondary'} className={expense.is_active ? 'bg-income/10 text-income' : ''}>
                            {expense.is_active ? 'Activo' : 'Pausado'}
                          </Badge>
                          <div className="text-right font-bold">
                            <CurrencyDisplay amount={Number(expense.amount)} currency={expense.currency} size="md" />
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Switch checked={expense.is_active} onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: expense.id, is_active: checked })} />
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPriceUpdate(expense)}><DollarSign className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(expense)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm('¿Eliminar?')) deleteMutation.mutate(expense.id); }}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="cards" className="space-y-4">
              {(!installmentTransactions || installmentTransactions.length === 0) ? (
                <EmptyState icon={CreditCard} title="Sin cuotas este mes" description={`No hay cuotas programadas para ${getMonthName(month)} ${year}`} />
              ) : (
                <div className="space-y-3">
                  {installmentTransactions.map((tx) => {
                    const { paidCount, total, baseName } = getPurchaseProgress(tx);
                    const progress = total > 0 ? Math.round((paidCount / total) * 100) : 0;
                    const isFullyPaid = paidCount >= total;
                    const currentInstallment = tx.current_installment || 1;
                    
                    return (
                      <Card key={tx.id} className="glass border-border/50 hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate(`/transactions/${tx.id}`)}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                              <CreditCard className="h-5 w-5 text-warning" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{baseName}</h4>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{tx.account?.name || 'Sin cuenta'}</span>
                                {tx.category && (
                                  <>
                                    <span>•</span>
                                    <span>{tx.category.name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <CurrencyDisplay amount={Number(tx.amount)} currency={tx.currency} size="md" className="font-bold" />
                              <p className="text-xs text-muted-foreground">cuota {currentInstallment}</p>
                            </div>
                            <div className="text-right min-w-[120px]">
                              <Badge variant={isFullyPaid ? 'default' : 'secondary'} className={isFullyPaid ? 'bg-income/10 text-income' : ''}>
                                Cuota {currentInstallment}/{total}
                              </Badge>
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground">{paidCount}/{total}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Price Update Dialog */}
      <Dialog open={isPriceUpdateOpen} onOpenChange={setIsPriceUpdateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Actualizar Precio</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Actualiza el precio de <strong>{selectedExpenseForUpdate?.name}</strong>.</p>
            {selectedExpenseForUpdate?.price_history && selectedExpenseForUpdate.price_history.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs font-medium mb-2">Historial</p>
                {selectedExpenseForUpdate.price_history.slice(-3).map((entry, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span>{format(new Date(entry.effective_date), 'd MMM yyyy', { locale: es })}</span>
                    <span>{CURRENCY_SYMBOLS[selectedExpenseForUpdate.currency]} {entry.amount}</span>
                  </div>
                ))}
              </div>
            )}
            <div><Label>Nuevo monto</Label><Input type="number" value={priceUpdateData.amount} onChange={(e) => setPriceUpdateData({ ...priceUpdateData, amount: e.target.value })} /></div>
            <div><Label>Fecha efectiva</Label><Input type="date" value={priceUpdateData.effective_date} onChange={(e) => setPriceUpdateData({ ...priceUpdateData, effective_date: e.target.value })} /></div>
            <div><Label>Notas</Label><Input value={priceUpdateData.notes} onChange={(e) => setPriceUpdateData({ ...priceUpdateData, notes: e.target.value })} placeholder="Ej: Aumento por inflación" /></div>
            <Button onClick={() => updatePriceMutation.mutate()} className="w-full" disabled={updatePriceMutation.isPending || !priceUpdateData.amount}>
              {updatePriceMutation.isPending ? 'Actualizando...' : 'Actualizar Precio'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
