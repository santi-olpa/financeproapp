import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { 
  Plus, 
  Repeat, 
  Edit, 
  Trash2, 
  Calendar, 
  TrendingDown,
  History,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, addWeeks, addMonths, addYears, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import type { RecurringExpense, Category, Account, Currency, RecurringFrequency, PriceHistoryEntry, Transaction } from '@/types/finance';
import { FREQUENCY_LABELS, CURRENCY_SYMBOLS } from '@/types/finance';
import { getMonthName, getCurrentPeriod } from '@/lib/format';

export default function RecurringExpenses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
  const [isPriceUpdateOpen, setIsPriceUpdateOpen] = useState(false);
  const [selectedExpenseForUpdate, setSelectedExpenseForUpdate] = useState<RecurringExpense | null>(null);
  const { month, year } = getCurrentPeriod();

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
        .select(`
          *,
          category:categories(*),
          account:accounts(*)
        `)
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

  // Fetch current month transactions for expenses report
  const { data: monthlyTransactions } = useQuery({
    queryKey: ['transactions', 'expense', month, year],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('transaction_type', 'expense')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      return data as unknown as Transaction[];
    },
    enabled: !!user,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const initialPriceHistory = [{
        amount: parseFloat(data.amount),
        effective_date: data.start_date,
        notes: 'Precio inicial'
      }];

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
          .update({
            name: payload.name,
            description: payload.description,
            category_id: payload.category_id,
            account_id: payload.account_id,
            frequency: payload.frequency,
            next_due_date: payload.next_due_date,
            notes: payload.notes,
          })
          .eq('id', editingExpense.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('recurring_expenses')
          .insert([payload] as any);
        
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
    onError: (error) => {
      console.error('Error saving recurring expense:', error);
      toast.error('Error al guardar');
    },
  });

  // Update price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedExpenseForUpdate) return;
      
      const newEntry: PriceHistoryEntry = {
        amount: parseFloat(priceUpdateData.amount),
        effective_date: priceUpdateData.effective_date,
        notes: priceUpdateData.notes || undefined,
      };

      const updatedHistory = [...(selectedExpenseForUpdate.price_history || []), newEntry];

      const { error } = await supabase
        .from('recurring_expenses')
        .update({
          amount: parseFloat(priceUpdateData.amount),
          price_history: updatedHistory as any,
        })
        .eq('id', selectedExpenseForUpdate.id);
      
      if (error) throw error;

      // Also update future pending transactions if any
      const effectiveDate = priceUpdateData.effective_date;
      const { error: txError } = await supabase
        .from('transactions')
        .update({ amount: parseFloat(priceUpdateData.amount) })
        .eq('recurring_expense_id', selectedExpenseForUpdate.id)
        .gte('transaction_date', effectiveDate);
      
      if (txError) console.error('Error updating future transactions:', txError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setIsPriceUpdateOpen(false);
      setSelectedExpenseForUpdate(null);
      setPriceUpdateData({ amount: '', effective_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
      toast.success('Precio actualizado correctamente');
    },
    onError: () => {
      toast.error('Error al actualizar precio');
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('recurring_expenses')
        .update({ is_active, end_date: is_active ? null : format(new Date(), 'yyyy-MM-dd') })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      toast.success('Estado actualizado');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_expenses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      toast.success('Gasto recurrente eliminado');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      amount: '',
      currency: 'ARS',
      category_id: '',
      account_id: '',
      frequency: 'monthly',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      next_due_date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    });
  };

  const openEdit = (expense: RecurringExpense) => {
    setEditingExpense(expense);
    setFormData({
      name: expense.name,
      description: expense.description || '',
      amount: String(expense.amount),
      currency: expense.currency,
      category_id: expense.category_id || '',
      account_id: expense.account_id || '',
      frequency: expense.frequency,
      start_date: expense.start_date,
      next_due_date: expense.next_due_date,
      notes: expense.notes || '',
    });
    setIsDialogOpen(true);
  };

  const openPriceUpdate = (expense: RecurringExpense) => {
    setSelectedExpenseForUpdate(expense);
    setPriceUpdateData({
      amount: String(expense.amount),
      effective_date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    });
    setIsPriceUpdateOpen(true);
  };

  // Calculate projected monthly recurring expenses
  const projectedRecurringTotal = recurringExpenses
    ?.filter(e => e.is_active)
    .reduce((sum, expense) => {
      if (expense.currency === 'ARS') {
        // Calculate how many times this expense occurs in a month
        const multiplier = expense.frequency === 'weekly' ? 4 : 
                          expense.frequency === 'biweekly' ? 2 : 
                          expense.frequency === 'monthly' ? 1 :
                          expense.frequency === 'quarterly' ? 0.33 :
                          0.083; // yearly
        return sum + (Number(expense.amount) * multiplier);
      }
      return sum;
    }, 0) ?? 0;

  // Group expenses by category
  const expensesByCategory = monthlyTransactions?.reduce((acc, tx) => {
    const categoryName = tx.category?.name || 'Sin categoría';
    if (!acc[categoryName]) {
      acc[categoryName] = { total: 0, color: tx.category?.color || '#6b7280' };
    }
    acc[categoryName].total += Number(tx.amount);
    return acc;
  }, {} as Record<string, { total: number; color: string }>) ?? {};

  const totalMonthlyExpenses = monthlyTransactions?.reduce((sum, tx) => sum + Number(tx.amount), 0) ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title="Gastos" 
        subtitle="Panel de egresos y recurrentes"
        action={
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingExpense(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Recurrente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingExpense ? 'Editar Gasto Recurrente' : 'Nuevo Gasto Recurrente'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Netflix, Alquiler, Gym"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="amount">Monto</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                      disabled={!!editingExpense}
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Moneda</Label>
                    <Select 
                      value={formData.currency} 
                      onValueChange={(v) => setFormData({ ...formData, currency: v as Currency })}
                      disabled={!!editingExpense}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ARS">ARS</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="frequency">Frecuencia</Label>
                  <Select 
                    value={formData.frequency} 
                    onValueChange={(v) => setFormData({ ...formData, frequency: v as RecurringFrequency })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="category">Categoría</Label>
                  <Select 
                    value={formData.category_id} 
                    onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="account">Cuenta de débito</Label>
                  <Select 
                    value={formData.account_id} 
                    onValueChange={(v) => setFormData({ ...formData, account_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} ({acc.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="next_due_date">Próximo vencimiento</Label>
                  <Input
                    id="next_due_date"
                    type="date"
                    value={formData.next_due_date}
                    onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notas</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Notas adicionales"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Guardando...' : (editingExpense ? 'Actualizar' : 'Crear')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-4 max-w-4xl mx-auto">
        <Tabs defaultValue="monthly" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="monthly">Gastos del Mes</TabsTrigger>
            <TabsTrigger value="recurring">Recurrentes</TabsTrigger>
          </TabsList>

          {/* Monthly Expenses Tab */}
          <TabsContent value="monthly" className="space-y-4">
            {/* Summary Card */}
            <Card className="glass border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{getMonthName(month)} {year}</p>
                    <p className="text-2xl font-bold text-expense">
                      {CURRENCY_SYMBOLS.ARS} {totalMonthlyExpenses.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Recurrentes proyectados</p>
                    <p className="text-lg font-semibold text-muted-foreground">
                      ~ {CURRENCY_SYMBOLS.ARS} {projectedRecurringTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>

                {/* Category breakdown */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Por categoría</p>
                  {Object.entries(expensesByCategory)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([category, data]) => (
                      <div key={category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: data.color }}
                          />
                          <span className="text-sm">{category}</span>
                        </div>
                        <span className="text-sm font-medium">
                          {CURRENCY_SYMBOLS.ARS} {data.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent expenses list */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Últimos gastos</h3>
              {monthlyTransactions?.length === 0 ? (
                <EmptyState
                  icon={TrendingDown}
                  title="Sin gastos"
                  description="No hay gastos registrados este mes"
                />
              ) : (
                monthlyTransactions?.map((tx) => (
                  <Card key={tx.id} className="glass border-border/50">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-2 h-8 rounded-full" 
                          style={{ backgroundColor: tx.category?.color || '#6b7280' }}
                        />
                        <div>
                          <p className="text-sm font-medium">{tx.description || 'Sin descripción'}</p>
                          <p className="text-xs text-muted-foreground">
                            {tx.category?.name} • {format(new Date(tx.transaction_date), 'd MMM', { locale: es })}
                          </p>
                        </div>
                      </div>
                      <CurrencyDisplay 
                        amount={Number(tx.amount)} 
                        currency={tx.currency}
                        size="sm"
                        className="text-expense"
                      />
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Recurring Expenses Tab */}
          <TabsContent value="recurring" className="space-y-4">
            {/* Summary */}
            <Card className="glass border-border/50">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Activos</p>
                    <p className="text-2xl font-bold">
                      {recurringExpenses?.filter(e => e.is_active).length || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Proyección mensual</p>
                    <p className="text-xl font-semibold text-expense">
                      ~ {CURRENCY_SYMBOLS.ARS} {projectedRecurringTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recurring expenses list */}
            {(!recurringExpenses || recurringExpenses.length === 0) ? (
              <EmptyState
                icon={Repeat}
                title="Sin gastos recurrentes"
                description="Agrega tus gastos fijos como servicios, suscripciones, alquiler, etc."
              />
            ) : (
              <div className="space-y-3">
                {recurringExpenses.map((expense) => (
                  <Card 
                    key={expense.id} 
                    className={`glass border-border/50 ${!expense.is_active ? 'opacity-50' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{expense.name}</h3>
                            <Badge variant={expense.is_active ? 'default' : 'secondary'} className="text-xs">
                              {expense.is_active ? FREQUENCY_LABELS[expense.frequency] : 'Inactivo'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {expense.category?.name || 'Sin categoría'}
                            {expense.account && ` • ${expense.account.name}`}
                          </p>
                        </div>
                        <CurrencyDisplay 
                          amount={Number(expense.amount)} 
                          currency={expense.currency}
                          size="lg"
                          className="text-expense"
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Próximo: {format(new Date(expense.next_due_date), 'd MMM yyyy', { locale: es })}</span>
                        </div>
                        {expense.price_history && expense.price_history.length > 1 && (
                          <div className="flex items-center gap-1">
                            <History className="h-3 w-3" />
                            <span>{expense.price_history.length} cambios de precio</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={expense.is_active}
                            onCheckedChange={(checked) => 
                              toggleActiveMutation.mutate({ id: expense.id, is_active: checked })
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            {expense.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openPriceUpdate(expense)}
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(expense)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              if (confirm('¿Eliminar este gasto recurrente?')) {
                                deleteMutation.mutate(expense.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Price Update Dialog */}
      <Dialog open={isPriceUpdateOpen} onOpenChange={setIsPriceUpdateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Actualizar Precio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Actualiza el precio de <strong>{selectedExpenseForUpdate?.name}</strong>. 
              Este cambio se aplicará desde la fecha indicada.
            </p>
            
            {selectedExpenseForUpdate?.price_history && selectedExpenseForUpdate.price_history.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs font-medium mb-2">Historial de precios</p>
                {selectedExpenseForUpdate.price_history.slice(-3).map((entry, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span>{format(new Date(entry.effective_date), 'd MMM yyyy', { locale: es })}</span>
                    <span>{CURRENCY_SYMBOLS[selectedExpenseForUpdate.currency]} {entry.amount}</span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label htmlFor="new_amount">Nuevo monto</Label>
              <Input
                id="new_amount"
                type="number"
                step="0.01"
                value={priceUpdateData.amount}
                onChange={(e) => setPriceUpdateData({ ...priceUpdateData, amount: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="effective_date">Fecha efectiva</Label>
              <Input
                id="effective_date"
                type="date"
                value={priceUpdateData.effective_date}
                onChange={(e) => setPriceUpdateData({ ...priceUpdateData, effective_date: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="price_notes">Notas (opcional)</Label>
              <Input
                id="price_notes"
                value={priceUpdateData.notes}
                onChange={(e) => setPriceUpdateData({ ...priceUpdateData, notes: e.target.value })}
                placeholder="Ej: Aumento por inflación"
              />
            </div>

            <Button 
              onClick={() => updatePriceMutation.mutate()} 
              className="w-full"
              disabled={updatePriceMutation.isPending || !priceUpdateData.amount}
            >
              {updatePriceMutation.isPending ? 'Actualizando...' : 'Actualizar Precio'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
