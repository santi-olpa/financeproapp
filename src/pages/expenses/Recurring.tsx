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
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Repeat,
  Edit,
  Trash2,
  DollarSign,
  Play,
  Loader2,
  Download,
} from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { RecurringExpense, Category, Account, Currency, RecurringFrequency, PriceHistoryEntry } from '@/types/finance';
import { FREQUENCY_LABELS } from '@/types/finance';
import { formatRelativeDate } from '@/lib/format';

export default function RecurringExpenses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
  const [isPriceUpdateOpen, setIsPriceUpdateOpen] = useState(false);
  const [selectedExpenseForUpdate, setSelectedExpenseForUpdate] = useState<RecurringExpense | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // === QUERIES ===

  const { data: recurringExpenses, isLoading } = useQuery({
    queryKey: ['recurring-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*, category:categories(name, icon, color), account:accounts(name)')
        .order('next_due_date', { ascending: true });
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        price_history: (item.price_history as unknown as PriceHistoryEntry[]) || [],
      })) as unknown as (RecurringExpense & { category: { name: string } | null; account: { name: string } | null })[];
    },
    enabled: !!user,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories', 'expense'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('category_type', 'expense').order('display_order');
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return data as Account[];
    },
    enabled: !!user,
  });

  // === MUTATIONS ===

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
        price_history: initialPriceHistory as unknown as Record<string, unknown>[],
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
    } catch {
      toast.error('Error al procesar gastos recurrentes');
    } finally {
      setIsProcessing(false);
    }
  };

  const activeExpenses = recurringExpenses?.filter(e => e.is_active) ?? [];
  const inactiveExpenses = recurringExpenses?.filter(e => !e.is_active) ?? [];
  const totalMonthly = activeExpenses.filter(e => e.currency === 'ARS').reduce((sum, e) => {
    const multiplier = e.frequency === 'weekly' ? 4 : e.frequency === 'biweekly' ? 2 : e.frequency === 'monthly' ? 1 : e.frequency === 'quarterly' ? 0.33 : 0.083;
    return sum + Number(e.amount) * multiplier;
  }, 0);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Gastos Recurrentes"
        subtitle="Tus gastos fijos mensuales"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleProcessRecurring} disabled={isProcessing} className="rounded-full">
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              <span className="hidden sm:inline ml-1">Procesar</span>
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingExpense(null); resetForm(); } }}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Nuevo</span></Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingExpense ? 'Editar' : 'Nuevo'} Gasto Recurrente</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-4">
                  <div className="space-y-2"><Label>Nombre</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Alquiler, Netflix..." required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Monto</Label><Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required disabled={!!editingExpense} className="font-mono" /></div>
                    <div className="space-y-2"><Label>Moneda</Label><Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v as Currency })} disabled={!!editingExpense}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">ARS</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
                  </div>
                  <div className="space-y-2"><Label>Frecuencia</Label><Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v as RecurringFrequency })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FREQUENCY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Categoría</Label><Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Cuenta</Label><Select value={formData.account_id} onValueChange={(v) => setFormData({ ...formData, account_id: v })}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{accounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Próximo vencimiento</Label><Input type="date" value={formData.next_due_date} onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })} required /></div>
                  <Button type="submit" className="w-full" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Guardando...' : 'Guardar'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Resumen */}
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Costo fijo mensual estimado</p>
                  <CurrencyDisplay amount={totalMonthly} currency="ARS" size="xl" className="font-bold" enablePrivacy />
                </div>
              </div>
              <HelpTooltip text="Suma mensualizada de todos tus gastos recurrentes activos en ARS. Semanales se multiplican por 4, quincenales por 2, etc." />
            </CardContent>
          </Card>

          {/* Lista activos */}
          {activeExpenses.length === 0 && inactiveExpenses.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="Sin gastos recurrentes"
              description="Agrega tus gastos fijos (alquiler, servicios, suscripciones) para calcular tu costo de vida."
            />
          ) : (
            <>
              {activeExpenses.length > 0 && (
                <div className="space-y-2">
                  {activeExpenses.map((expense) => (
                    <Card key={expense.id} className="border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium truncate">{expense.name}</h3>
                              <Badge variant="outline" className="text-xs shrink-0">{FREQUENCY_LABELS[expense.frequency]}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {expense.category?.name ?? 'Sin categoría'}
                              {expense.account?.name && ` · ${expense.account.name}`}
                              {` · Próximo: ${formatRelativeDate(expense.next_due_date)}`}
                            </p>
                          </div>
                          <CurrencyDisplay amount={Number(expense.amount)} currency={expense.currency} size="md" className="font-semibold shrink-0" />
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPriceUpdate(expense)} title="Actualizar precio">
                              <DollarSign className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(expense)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Switch
                              checked={expense.is_active}
                              onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: expense.id, is_active: checked })}
                            />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>¿Eliminar "{expense.name}"?</AlertDialogTitle><AlertDialogDescription>Se eliminará permanentemente.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(expense.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {inactiveExpenses.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Inactivos</h3>
                  <div className="space-y-2 opacity-60">
                    {inactiveExpenses.map((expense) => (
                      <Card key={expense.id} className="border-border/50">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm truncate">{expense.name}</p>
                            <p className="text-xs text-muted-foreground">{expense.category?.name ?? 'Sin categoría'}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <CurrencyDisplay amount={Number(expense.amount)} currency={expense.currency} size="sm" />
                            <Switch
                              checked={false}
                              onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: expense.id, is_active: checked })}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialog de actualización de precio */}
      <Dialog open={isPriceUpdateOpen} onOpenChange={setIsPriceUpdateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Actualizar precio</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updatePriceMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2"><Label>Nuevo monto</Label><Input type="number" step="0.01" value={priceUpdateData.amount} onChange={(e) => setPriceUpdateData({ ...priceUpdateData, amount: e.target.value })} className="font-mono" required /></div>
            <div className="space-y-2"><Label>Fecha efectiva</Label><Input type="date" value={priceUpdateData.effective_date} onChange={(e) => setPriceUpdateData({ ...priceUpdateData, effective_date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Nota (opcional)</Label><Input value={priceUpdateData.notes} onChange={(e) => setPriceUpdateData({ ...priceUpdateData, notes: e.target.value })} placeholder="Ej: Aumento de marzo" /></div>
            <Button type="submit" className="w-full" disabled={updatePriceMutation.isPending}>{updatePriceMutation.isPending ? 'Actualizando...' : 'Actualizar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
