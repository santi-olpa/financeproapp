import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { getMonthName } from '@/lib/format';
import type { Account, Category, Currency } from '@/types/finance';

export default function NewPurchase() {
  const { id: paramCardId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCardId, setSelectedCardId] = useState(paramCardId || '');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('ARS');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [installmentsCount, setInstallmentsCount] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');

  const cardId = selectedCardId;

  // Fetch all credit cards (para selector cuando no viene por URL)
  const { data: creditCards = [] } = useQuery({
    queryKey: ['accounts', 'credit-cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .eq('account_type', 'credit_card')
        .order('name');
      if (error) throw error;
      return data as Account[];
    },
    enabled: !!user,
  });

  // La tarjeta seleccionada (del selector o del param)
  const card = creditCards.find(c => c.id === cardId) ?? null;

  // Fetch expense categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'expense'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('category_type', 'expense')
        .order('display_order');
      if (error) throw error;
      return data as Category[];
    },
  });

  // Preview de cuotas
  const installmentPreview = useMemo(() => {
    const totalAmount = parseFloat(amount) || 0;
    const count = parseInt(installmentsCount) || 1;
    if (totalAmount <= 0 || count <= 0 || !card?.closing_day) return [];

    const installmentAmount = Math.round((totalAmount / count) * 100) / 100;
    const purchaseDateObj = new Date(purchaseDate + 'T12:00:00');
    const purchaseDay = purchaseDateObj.getDate();

    let startMonth = purchaseDateObj.getMonth();
    let startYear = purchaseDateObj.getFullYear();
    if (purchaseDay > card.closing_day) {
      startMonth += 1;
      if (startMonth > 11) { startMonth = 0; startYear += 1; }
    }

    const preview = [];
    for (let i = 0; i < count; i++) {
      let m = startMonth + i;
      let y = startYear;
      while (m > 11) { m -= 12; y += 1; }
      preview.push({ number: i + 1, month: m + 1, year: y, amount: installmentAmount });
    }
    return preview;
  }, [amount, installmentsCount, purchaseDate, card?.closing_day]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('purchases').insert({
        user_id: user!.id,
        card_account_id: cardId,
        description,
        merchant: merchant || null,
        total_amount: parseFloat(amount),
        original_currency: currency,
        purchase_date: purchaseDate,
        installments_count: parseInt(installmentsCount) || 1,
        interest_rate: 0,
        category_id: categoryId || null,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['installments'] });
      toast({ title: 'Compra cargada', description: 'Las cuotas se generaron automáticamente.' });
      // Si vino de una tarjeta, volver ahí; si no, ir a movimientos
      navigate(paramCardId ? `/cards/${paramCardId}` : '/transactions');
    },
    onError: (error) => {
      console.error(error);
      toast({ title: 'Error', description: 'No se pudo cargar la compra.', variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardId) {
      toast({ title: 'Error', description: 'Seleccioná una tarjeta.', variant: 'destructive' });
      return;
    }
    if (!description.trim()) {
      toast({ title: 'Error', description: 'La descripción es requerida.', variant: 'destructive' });
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: 'Error', description: 'El monto debe ser mayor a cero.', variant: 'destructive' });
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Nueva Compra con Tarjeta" subtitle={card?.name || 'Seleccioná una tarjeta'} showBack />

      <form onSubmit={handleSubmit} className="p-4 space-y-6 max-w-lg mx-auto">
        {/* Selector de tarjeta (si no viene por URL) */}
        {!paramCardId && (
          <div className="space-y-2">
            <Label>Tarjeta</Label>
            {creditCards.length === 0 ? (
              <Card className="border-warning/30 bg-warning/5">
                <CardContent className="p-3 text-sm text-muted-foreground">
                  No tenés tarjetas de crédito cargadas. <a href="/accounts/new" className="text-primary underline">Agregá una</a> primero.
                </CardContent>
              </Card>
            ) : (
              <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tarjeta" />
                </SelectTrigger>
                <SelectContent>
                  {creditCards.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.name} ({cc.currency}) · Cierre día {cc.closing_day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Input
            id="description"
            placeholder="Ej: Zapatillas Nike, Notebook Lenovo..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="merchant">Comercio (opcional)</Label>
          <Input
            id="merchant"
            placeholder="Ej: MercadoLibre, Fravega..."
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Monto total</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Moneda</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">$ ARS</SelectItem>
                <SelectItem value="USD">US$ USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {currency === 'USD' && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              El monto se va a pesificar al cierre con el dólar tarjeta del mes.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date">Fecha de compra</Label>
            <Input id="date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="installments">Cuotas</Label>
              <HelpTooltip text="Si es en 1 pago, dejá 1. Si es en cuotas, indicá cuántas. Las cuotas se asignan automáticamente a cada mes." />
            </div>
            <Input
              id="installments"
              type="number"
              min="1"
              max="48"
              value={installmentsCount}
              onChange={(e) => setInstallmentsCount(e.target.value)}
            />
          </div>
        </div>

        {installmentPreview.length > 1 && (
          <Card className="border-border/50">
            <CardContent className="p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Preview: {installmentPreview.length} cuotas de{' '}
                <CurrencyDisplay amount={installmentPreview[0].amount} currency={currency} size="sm" className="inline" />
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 text-xs">
                {installmentPreview.slice(0, 8).map((p) => (
                  <span key={p.number} className="text-muted-foreground">
                    {p.number}. {getMonthName(p.month).slice(0, 3)} {p.year !== new Date().getFullYear() ? p.year : ''}
                  </span>
                ))}
                {installmentPreview.length > 8 && (
                  <span className="text-muted-foreground">...+{installmentPreview.length - 8} más</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <Label>Categoría (opcional)</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notas (opcional)</Label>
          <Textarea id="notes" placeholder="Notas adicionales..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <Button type="submit" className="w-full" disabled={createMutation.isPending || !cardId}>
          {createMutation.isPending ? <LoadingSpinner size="sm" /> : 'Crear compra'}
        </Button>
      </form>
    </div>
  );
}
