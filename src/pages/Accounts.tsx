import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { PatrimonyEvolutionChart } from '@/components/accounts/PatrimonyEvolutionChart';
import { AccountGroupSection } from '@/components/accounts/AccountGroupSection';
import {
  Plus,
  Wallet,
  Building2,
  CreditCard,
  PiggyBank,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Account, AccountSubtype } from '@/types/finance';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const SUBTYPE_CONFIG: Record<AccountSubtype, { label: string; icon: typeof Wallet; tooltip: string }> = {
  operating: {
    label: 'Operativas',
    icon: Building2,
    tooltip: 'Cuentas de uso diario: bancos, billeteras, efectivo. Su saldo se cuenta como liquidez disponible.',
  },
  reserve: {
    label: 'Ahorro',
    icon: PiggyBank,
    tooltip: 'Cuentas separadas para guardar. No cuentan como liquidez disponible pero sí como patrimonio.',
  },
  liability: {
    label: 'Tarjetas de Crédito',
    icon: CreditCard,
    tooltip: 'Tus tarjetas. Acá ves la deuda actual de cada una y podés gestionar compras y pagos de resumen.',
  },
  investment: {
    label: 'Inversiones',
    icon: TrendingUp,
    tooltip: 'Inversiones: FCI, bonos, acciones, crypto. No cuentan como liquidez pero sí como patrimonio.',
  },
};

const SUBTYPE_ORDER: AccountSubtype[] = ['operating', 'reserve', 'liability', 'investment'];

export default function Accounts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Account[];
    },
    enabled: !!user,
  });

  const syncAllBalances = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      await supabase.rpc('recalculate_all_account_balances', { p_user_id: user.id });
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: 'Saldos sincronizados', description: 'Todos los saldos fueron recalculados.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudieron sincronizar los saldos.', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const syncSingleAccount = async (accountId: string) => {
    try {
      await supabase.rpc('recalculate_account_balance', { p_account_id: accountId });
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: 'Saldo actualizado' });
    } catch {
      toast({ title: 'Error al sincronizar', variant: 'destructive' });
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: 'Cuenta eliminada' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo eliminar la cuenta.', variant: 'destructive' });
    },
  });

  // Agrupar por subtype
  const groupedBySubtype = accounts?.reduce((groups, account) => {
    const subtype = account.account_subtype || 'operating';
    if (!groups[subtype]) groups[subtype] = [];
    groups[subtype].push(account);
    return groups;
  }, {} as Partial<Record<AccountSubtype, Account[]>>);

  // Totales de patrimonio
  const activeAccounts = accounts?.filter(a => a.is_active) ?? [];
  const totalARS = activeAccounts
    .filter(a => a.currency === 'ARS')
    .reduce((sum, a) => sum + Number(a.current_balance), 0);
  const totalUSD = activeAccounts
    .filter(a => a.currency === 'USD')
    .reduce((sum, a) => sum + Number(a.current_balance), 0);

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
        title="Mis Cuentas"
        subtitle="Tus disponibilidades, ahorros y tarjetas"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-full" onClick={syncAllBalances} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sincronizar</span>
            </Button>
            <Link to="/accounts/new">
              <Button className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Nueva Cuenta</span>
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
          {/* Patrimonio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <Card className="border-border/50 bg-gradient-to-br from-card to-primary/5">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-muted-foreground">Patrimonio Neto (ARS)</p>
                  <HelpTooltip text="Es lo que realmente tenés. Sumamos el dinero en todas tus cuentas (operativas y de ahorro) y le restamos lo que debés en tarjetas." />
                </div>
                <CurrencyDisplay amount={totalARS} currency="ARS" size="xl" className="font-extrabold" enablePrivacy />
              </CardContent>
            </Card>
            <Card className="border-border/50 border-l-4 border-l-income">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-muted-foreground">Patrimonio Neto (USD)</p>
                  <HelpTooltip text="Tus activos en dólares. No se convierte automáticamente; cada moneda se muestra por separado." />
                </div>
                <CurrencyDisplay amount={totalUSD} currency="USD" size="xl" className="font-extrabold" enablePrivacy />
              </CardContent>
            </Card>
          </div>

          {/* Evolución patrimonial */}
          <PatrimonyEvolutionChart />

          {/* Grupos de cuentas */}
          {(!accounts || accounts.length === 0) ? (
            <EmptyState
              icon={Wallet}
              title="Sin cuentas"
              description="Agrega tus cuentas bancarias, billeteras, tarjetas o inversiones para empezar"
              action={
                <Link to="/accounts/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar cuenta
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-6 md:space-y-8">
              {SUBTYPE_ORDER.map((subtype) => {
                const config = SUBTYPE_CONFIG[subtype];
                const groupAccounts = groupedBySubtype?.[subtype] ?? [];

                return (
                  <AccountGroupSection
                    key={subtype}
                    title={config.label}
                    tooltip={config.tooltip}
                    icon={config.icon}
                    accounts={groupAccounts}
                    subtype={subtype}
                    onDelete={setDeleteId}
                    onSync={syncSingleAccount}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán también todos los movimientos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteMutation.mutate(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
