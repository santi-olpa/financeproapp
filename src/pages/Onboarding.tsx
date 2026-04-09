import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Wallet,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import type { Currency, Category } from '@/types/finance';

const STEPS = ['welcome', 'account', 'card', 'categories', 'done'] as const;
type Step = typeof STEPS[number];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('welcome');
  const stepIndex = STEPS.indexOf(step);

  // Step 2: primera cuenta
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('bank');
  const [accountCurrency, setAccountCurrency] = useState<Currency>('ARS');
  const [accountBalance, setAccountBalance] = useState('');

  // Step 3: tarjeta
  const [wantsCard, setWantsCard] = useState<boolean | null>(null);
  const [cardName, setCardName] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');

  // Step 4: categorías esenciales
  const { data: essentialCategories = [] } = useQuery({
    queryKey: ['categories', 'essential'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_system', true)
        .eq('is_essential', true)
        .order('display_order');
      if (error) throw error;
      return data as Category[];
    },
    enabled: step === 'categories',
  });
  const [selectedEssentials, setSelectedEssentials] = useState<Set<string>>(new Set());

  // Al cargar las categorías, seleccionar todas por default
  const initEssentials = () => {
    if (essentialCategories.length > 0 && selectedEssentials.size === 0) {
      setSelectedEssentials(new Set(essentialCategories.map(c => c.id)));
    }
  };

  const toggleEssential = (id: string) => {
    const next = new Set(selectedEssentials);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedEssentials(next);
  };

  // Create account mutation
  const createAccountMutation = useMutation({
    mutationFn: async () => {
      const balance = parseFloat(accountBalance) || 0;
      const { error } = await supabase.from('accounts').insert({
        user_id: user!.id,
        name: accountName,
        account_type: accountType,
        account_subtype: 'operating',
        currency: accountCurrency,
        initial_balance: balance,
        current_balance: balance,
        icon: accountType,
        color: '#6366f1',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setStep('card');
    },
    onError: () => {
      toast({ title: 'Error al crear la cuenta', variant: 'destructive' });
    },
  });

  // Create card mutation
  const createCardMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('accounts').insert({
        user_id: user!.id,
        name: cardName,
        account_type: 'credit_card',
        account_subtype: 'liability',
        currency: 'ARS',
        initial_balance: 0,
        current_balance: 0,
        closing_day: parseInt(closingDay),
        due_day: parseInt(dueDay),
        icon: 'credit_card',
        color: '#f97316',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setStep('categories');
    },
    onError: () => {
      toast({ title: 'Error al crear la tarjeta', variant: 'destructive' });
    },
  });

  // Update essential categories
  const updateEssentialsMutation = useMutation({
    mutationFn: async () => {
      // Desmarcar las que el usuario sacó
      const toUnmark = essentialCategories.filter(c => !selectedEssentials.has(c.id));
      for (const cat of toUnmark) {
        await supabase.from('categories').update({ is_essential: false }).eq('id', cat.id);
      }
    },
    onSuccess: () => {
      setStep('done');
    },
  });

  // Mark onboarding as completed
  const finishMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      navigate('/dashboard');
    },
  });

  const next = () => setStep(STEPS[stepIndex + 1]);
  const skip = () => setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* === STEP 1: BIENVENIDA === */}
        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <div className="rounded-full bg-primary/10 p-6 w-24 h-24 mx-auto flex items-center justify-center">
              <Sparkles className="h-12 w-12 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">Bienvenido a Finance Pro</h1>
              <p className="text-muted-foreground">
                Tu copiloto financiero. Te ayudamos a entender tu plata, anticipar gastos y tomar mejores decisiones.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Vamos a configurar lo básico en 2 minutos. Después podés ajustar todo desde la app.
            </p>
            <Button className="w-full" size="lg" onClick={next}>
              Empezar <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* === STEP 2: PRIMERA CUENTA === */}
        {step === 'account' && (
          <div className="space-y-6">
            <div className="text-center">
              <Wallet className="h-10 w-10 text-primary mx-auto mb-3" />
              <h2 className="text-xl font-bold">¿Dónde tenés tu plata?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Empezá con tu cuenta principal. Después podés agregar más.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Banco</SelectItem>
                    <SelectItem value="wallet">Billetera (MP, Ualá...)</SelectItem>
                    <SelectItem value="cash">Efectivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  placeholder="Ej: Santander, Mercado Pago..."
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select value={accountCurrency} onValueChange={(v) => setAccountCurrency(v as Currency)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">$ ARS</SelectItem>
                      <SelectItem value="USD">US$ USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Saldo actual</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={accountBalance}
                    onChange={(e) => setAccountBalance(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" onClick={skip} className="flex-1">
                <SkipForward className="h-4 w-4 mr-1" /> Saltar
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (!accountName.trim()) {
                    toast({ title: 'Ponele un nombre a la cuenta', variant: 'destructive' });
                    return;
                  }
                  createAccountMutation.mutate();
                }}
                disabled={createAccountMutation.isPending}
              >
                {createAccountMutation.isPending ? <LoadingSpinner size="sm" /> : <>Siguiente <ArrowRight className="h-4 w-4 ml-1" /></>}
              </Button>
            </div>
          </div>
        )}

        {/* === STEP 3: TARJETA === */}
        {step === 'card' && (
          <div className="space-y-6">
            <div className="text-center">
              <CreditCard className="h-10 w-10 text-primary mx-auto mb-3" />
              <h2 className="text-xl font-bold">¿Tenés tarjeta de crédito?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Si la usás para compras en cuotas, la app te ayuda a trackear cuánto debés y cuándo vence.
              </p>
            </div>

            {wantsCard === null && (
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" size="lg" onClick={() => setWantsCard(true)}>
                  Sí, tengo
                </Button>
                <Button variant="outline" size="lg" onClick={() => { setWantsCard(false); setStep('categories'); }}>
                  No, por ahora no
                </Button>
              </div>
            )}

            {wantsCard && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre de la tarjeta</Label>
                  <Input placeholder="Ej: Visa Galicia" value={cardName} onChange={(e) => setCardName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Día de cierre</Label>
                    <Input type="number" min="1" max="31" placeholder="15" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Día de vencimiento</Label>
                    <Input type="number" min="1" max="31" placeholder="5" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep('categories')} className="flex-1">
                    <SkipForward className="h-4 w-4 mr-1" /> Saltar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      if (!cardName.trim() || !closingDay || !dueDay) {
                        toast({ title: 'Completá los datos de la tarjeta', variant: 'destructive' });
                        return;
                      }
                      createCardMutation.mutate();
                    }}
                    disabled={createCardMutation.isPending}
                  >
                    {createCardMutation.isPending ? <LoadingSpinner size="sm" /> : <>Siguiente <ArrowRight className="h-4 w-4 ml-1" /></>}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === STEP 4: CATEGORÍAS ESENCIALES === */}
        {step === 'categories' && (
          <div className="space-y-6">
            {initEssentials()}
            <div className="text-center">
              <h2 className="text-xl font-bold">Gastos esenciales</h2>
              <p className="text-sm text-muted-foreground mt-1">
                ¿Cuáles de estos gastos aplican a tu vida? Los usamos para calcular tu costo de vida fijo.
              </p>
            </div>

            <div className="space-y-2">
              {essentialCategories.map((cat) => {
                const isSelected = selectedEssentials.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleEssential(cat.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                    }`}>
                      {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-sm">{cat.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep('done')} className="flex-1">
                <SkipForward className="h-4 w-4 mr-1" /> Saltar
              </Button>
              <Button
                className="flex-1"
                onClick={() => updateEssentialsMutation.mutate()}
                disabled={updateEssentialsMutation.isPending}
              >
                {updateEssentialsMutation.isPending ? <LoadingSpinner size="sm" /> : <>Siguiente <ArrowRight className="h-4 w-4 ml-1" /></>}
              </Button>
            </div>
          </div>
        )}

        {/* === STEP 5: LISTO === */}
        {step === 'done' && (
          <div className="text-center space-y-6">
            <div className="rounded-full bg-income/10 p-6 w-24 h-24 mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-income" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">¡Todo listo!</h1>
              <p className="text-muted-foreground">
                Ya podés empezar a usar Finance Pro. Cargá tu primer movimiento o explorá el dashboard.
              </p>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={() => finishMutation.mutate()}
              disabled={finishMutation.isPending}
            >
              {finishMutation.isPending ? <LoadingSpinner size="sm" /> : 'Ir al Dashboard'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
