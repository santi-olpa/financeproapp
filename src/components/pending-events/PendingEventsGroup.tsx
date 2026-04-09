import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  ChevronDown,
  ChevronRight,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatRelativeDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { differenceInDays, format } from 'date-fns';
import type { PendingEvent, PendingEventKind, Currency, Account, Category } from '@/types/finance';

export function PendingEventsGroup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  // Abrir formulario si viene ?newCheck=1 desde el FAB
  useEffect(() => {
    if (searchParams.get('newCheck') === '1') {
      setFormOpen(true);
      setIsCollapsed(false);
      searchParams.delete('newCheck');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Form state
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('ARS');
  const [counterparty, setCounterparty] = useState('');
  const [description, setDescription] = useState('');
  const [issueDate, setIssueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expectedDate, setExpectedDate] = useState(format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'));
  const [targetAccountId, setTargetAccountId] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [checkBank, setCheckBank] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch pending events
  const { data: events = [] } = useQuery({
    queryKey: ['pending-events', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_events')
        .select('*, category:categories(name, icon, color), target_account:accounts!pending_events_target_account_id_fkey(name)')
        .eq('status', 'pending')
        .order('expected_date');
      if (error) throw error;
      return data as PendingEvent[];
    },
    enabled: !!user,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('id, name, currency').eq('is_active', true).order('name');
      if (error) throw error;
      return data as Pick<Account, 'id' | 'name' | 'currency'>[];
    },
    enabled: !!user && formOpen,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('id, name, category_type').order('display_order');
      if (error) throw error;
      return data as Pick<Category, 'id' | 'name' | 'category_type'>[];
    },
    enabled: !!user && formOpen,
  });

  // Create
  const createMutation = useMutation({
    mutationFn: async () => {
      const kind: PendingEventKind = direction === 'in' ? 'check_received' : 'check_issued';
      const { error } = await supabase.from('pending_events').insert({
        user_id: user!.id,
        kind,
        direction,
        amount: parseFloat(amount),
        currency,
        counterparty_name: counterparty,
        description: description || null,
        category_id: categoryId || null,
        issue_date: issueDate,
        expected_date: expectedDate,
        target_account_id: targetAccountId || null,
        check_number: checkNumber || null,
        check_bank: checkBank || null,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-events'] });
      setFormOpen(false);
      resetForm();
      toast({ title: 'Cheque cargado' });
    },
    onError: () => toast({ title: 'Error al cargar cheque', variant: 'destructive' }),
  });

  // Clear (cobrar/pagar)
  const clearMutation = useMutation({
    mutationFn: async ({ eventId, accountId }: { eventId: string; accountId: string }) => {
      const { error } = await supabase.rpc('clear_pending_event', {
        p_event_id: eventId,
        p_target_account_id: accountId,
        p_actual_date: format(new Date(), 'yyyy-MM-dd'),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-events'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: 'Cheque procesado. Se creó el movimiento.' });
    },
    onError: (e) => toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' }),
  });

  // Cancel
  const cancelMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.rpc('cancel_pending_event', { p_event_id: eventId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-events'] });
      toast({ title: 'Cheque cancelado' });
    },
  });

  const resetForm = () => {
    setDirection('in'); setAmount(''); setCurrency('ARS'); setCounterparty('');
    setDescription(''); setExpectedDate(format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'));
    setIssueDate(format(new Date(), 'yyyy-MM-dd'));
    setTargetAccountId(''); setCheckNumber(''); setCheckBank('');
    setCategoryId(''); setNotes('');
  };

  // Siempre visible: header con botón + Nuevo aunque no haya cheques

  const received = events.filter(e => e.direction === 'in');
  const issued = events.filter(e => e.direction === 'out');
  const totalReceived = received.reduce((s, e) => s + Number(e.amount), 0);
  const totalIssued = issued.reduce((s, e) => s + Number(e.amount), 0);
  const today = new Date();
  const overdueCount = events.filter(e => new Date(e.expected_date) < today).length;

  return (
    <section>
      <button onClick={() => setIsCollapsed(!isCollapsed)} className="flex items-center gap-2 mb-4 w-full text-left group">
        {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
          Cheques pendientes
        </span>
        {overdueCount > 0 && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{overdueCount} vencidos</Badge>}
        <span className="ml-auto">
          <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={(e) => e.stopPropagation()}>
                <Plus className="h-3 w-3 mr-1" /> Nuevo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nuevo cheque</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setDirection('in')} className={`p-3 rounded-lg border text-center text-sm transition-colors ${direction === 'in' ? 'border-income bg-income/10 text-income' : 'border-border'}`}>
                    <ArrowDownLeft className="h-4 w-4 mx-auto mb-1" /> Recibido
                  </button>
                  <button type="button" onClick={() => setDirection('out')} className={`p-3 rounded-lg border text-center text-sm transition-colors ${direction === 'out' ? 'border-expense bg-expense/10 text-expense' : 'border-border'}`}>
                    <ArrowUpRight className="h-4 w-4 mx-auto mb-1" /> Emitido
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Monto</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" required /></div>
                  <div className="space-y-2"><Label>Moneda</Label><Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">ARS</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
                </div>
                <div className="space-y-2"><Label>{direction === 'in' ? 'De quién' : 'Para quién'}</Label><Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder={direction === 'in' ? 'Ej: Cliente Juan Pérez' : 'Ej: Proveedor X'} required /></div>
                <div className="space-y-2"><Label>Descripción (opcional)</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Trabajo de marzo" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Fecha emisión</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Fecha cobro</Label><Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} required /></div>
                </div>
                <div className="space-y-2">
                  <Label>{direction === 'in' ? 'Cuenta donde depositar' : 'Cuenta de donde sale'}</Label>
                  <Select value={targetAccountId} onValueChange={setTargetAccountId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Nº cheque (opc.)</Label><Input value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Banco (opc.)</Label><Input value={checkBank} onChange={(e) => setCheckBank(e.target.value)} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Categoría (opc.)</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{categories.filter(c => direction === 'in' ? c.category_type === 'income' : c.category_type === 'expense').map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Notas (opc.)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? 'Guardando...' : 'Cargar cheque'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </span>
      </button>

      {!isCollapsed && (
        <div className="space-y-4">
          {/* Recibidos */}
          {received.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="h-3.5 w-3.5 text-income" />
                  <span className="text-xs font-medium text-muted-foreground">Recibidos</span>
                  <HelpTooltip text="Total de cheques que te dieron y todavía no cobraste. Son parte de tu patrimonio desde el día que los cargaste, pero no son liquidez todavía." />
                </div>
                <CurrencyDisplay amount={totalReceived} currency="ARS" size="sm" className="text-income font-semibold" enablePrivacy />
              </div>
              <div className="space-y-1.5">
                {received.map(ev => <EventCard key={ev.id} event={ev} accounts={accounts} onClear={clearMutation.mutate} onCancel={cancelMutation.mutate} />)}
              </div>
            </div>
          )}

          {/* Emitidos */}
          {issued.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-3.5 w-3.5 text-expense" />
                  <span className="text-xs font-medium text-muted-foreground">Emitidos</span>
                  <HelpTooltip text="Total de cheques que emitiste y el beneficiario todavía no cobró. Es plata que ya se descontó de tu patrimonio. Asegurate de tener saldo cerca de la fecha de cobro." />
                </div>
                <CurrencyDisplay amount={totalIssued} currency="ARS" size="sm" className="text-expense font-semibold" enablePrivacy />
              </div>
              <div className="space-y-1.5">
                {issued.map(ev => <EventCard key={ev.id} event={ev} accounts={accounts} onClear={clearMutation.mutate} onCancel={cancelMutation.mutate} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Sub-component: card individual de un cheque
function EventCard({
  event,
  accounts,
  onClear,
  onCancel,
}: {
  event: PendingEvent;
  accounts: Pick<Account, 'id' | 'name' | 'currency'>[];
  onClear: (data: { eventId: string; accountId: string }) => void;
  onCancel: (id: string) => void;
}) {
  const [clearOpen, setClearOpen] = useState(false);
  const [clearAccountId, setClearAccountId] = useState(event.target_account_id || '');
  const today = new Date();
  const expectedDate = new Date(event.expected_date);
  const daysLeft = differenceInDays(expectedDate, today);
  const isOverdue = daysLeft < 0;
  const isUrgent = daysLeft >= 0 && daysLeft <= 3;
  const isIn = event.direction === 'in';

  return (
    <Card className={cn('border-border/50', isOverdue && 'border-l-4 border-l-expense')}>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-full p-2 shrink-0', isIn ? 'bg-income/10' : 'bg-expense/10')}>
            {isIn ? <ArrowDownLeft className="h-4 w-4 text-income" /> : <ArrowUpRight className="h-4 w-4 text-expense" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{event.counterparty_name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {event.check_bank && `${event.check_bank} · `}
              {event.description || (isIn ? 'Cheque recibido' : 'Cheque emitido')}
            </p>
            <p className={cn('text-xs mt-0.5', isOverdue ? 'text-expense font-medium' : isUrgent ? 'text-warning' : 'text-muted-foreground')}>
              <Calendar className="h-3 w-3 inline mr-1" />
              {isOverdue ? `Vencido hace ${Math.abs(daysLeft)} días` : daysLeft === 0 ? 'Vence hoy' : `Faltan ${daysLeft} días · ${formatRelativeDate(event.expected_date)}`}
            </p>
          </div>
          <div className="text-right shrink-0">
            <CurrencyDisplay amount={Number(event.amount)} currency={event.currency} size="sm" className={isIn ? 'text-income' : 'text-expense'} />
            {event.category?.name && <Badge variant="outline" className="text-[9px] px-1 py-0 mt-1">{event.category.name}</Badge>}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-2 mt-2 pt-2 border-t border-border/30">
          <Dialog open={clearOpen} onOpenChange={setClearOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="default" className="flex-1 h-7 text-xs">
                {isIn ? 'Marcar cobrado' : 'Marcar pagado'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>{isIn ? 'Confirmar cobro' : 'Confirmar pago'}</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground mb-4">
                Se va a crear un {isIn ? 'ingreso' : 'egreso'} de <CurrencyDisplay amount={Number(event.amount)} currency={event.currency} size="sm" className="inline font-semibold" /> en la cuenta que selecciones.
              </p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Cuenta</Label>
                  <Select value={clearAccountId} onValueChange={setClearAccountId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                    <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button className="w-full" disabled={!clearAccountId} onClick={() => {
                  onClear({ eventId: event.id, accountId: clearAccountId });
                  setClearOpen(false);
                }}>
                  Confirmar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onCancel(event.id)}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
