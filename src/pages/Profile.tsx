import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePrivacy } from '@/hooks/usePrivacy';
import { useProfile } from '@/hooks/useProfile';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { InstallPWADialog } from '@/components/pwa/InstallPWADialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  LogOut,
  User,
  Eye,
  EyeOff,
  Smartphone,
  Save,
  Trash2,
  Download,
  Tags,
  Shield,
  Palette,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Currency, Category } from '@/types/finance';

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { hideAmounts, toggleHideAmounts } = usePrivacy();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isPWADialogOpen, setIsPWADialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Editable fields
  const [fullName, setFullName] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>('ARS');
  const [primaryKpi, setPrimaryKpi] = useState('runway');
  const [nameInitialized, setNameInitialized] = useState(false);

  // Initialize form from profile
  if (profile && !nameInitialized) {
    setFullName(profile.full_name || '');
    setDefaultCurrency(profile.default_currency);
    setPrimaryKpi(profile.primary_kpi);
    setNameInitialized(true);
  }

  // Categories for essential toggle
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'expense-system'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('category_type', 'expense')
        .eq('is_system', true)
        .order('display_order');
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });

  // Save profile
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName || null,
          default_currency: defaultCurrency,
          primary_kpi: primaryKpi,
        })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ title: 'Perfil actualizado' });
    },
    onError: () => {
      toast({ title: 'Error al guardar', variant: 'destructive' });
    },
  });

  // Toggle essential category
  const toggleEssentialMutation = useMutation({
    mutationFn: async ({ id, isEssential }: { id: string; isEssential: boolean }) => {
      const { error } = await supabase
        .from('categories')
        .update({ is_essential: isEssential })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  // Export data
  const handleExportData = async () => {
    try {
      const [txRes, accRes, recRes] = await Promise.all([
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('accounts').select('*'),
        supabase.from('recurring_expenses').select('*'),
      ]);

      const data = {
        exported_at: new Date().toISOString(),
        accounts: accRes.data ?? [],
        transactions: txRes.data ?? [],
        recurring_expenses: recRes.data ?? [],
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `financepro_export_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Datos exportados' });
    } catch {
      toast({ title: 'Error al exportar', variant: 'destructive' });
    }
  };

  const getInitials = (name: string | null, email?: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return email?.slice(0, 2).toUpperCase() || 'U';
  };

  if (profileLoading) {
    return <div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Perfil y Configuración" />

      <div className="p-4 md:p-6 space-y-6 max-w-lg mx-auto">

        {/* === PERFIL === */}
        <section className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Perfil</h3>
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-4">
              {/* Avatar + email */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {getInitials(profile?.full_name || null, user?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>

              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>

              {/* Moneda por defecto */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Moneda principal</Label>
                  <HelpTooltip text="La moneda que se muestra por defecto en el dashboard y reportes. Podés cambiarla en cualquier momento." />
                </div>
                <Select value={defaultCurrency} onValueChange={(v) => setDefaultCurrency(v as Currency)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">$ Pesos Argentinos (ARS)</SelectItem>
                    <SelectItem value="USD">US$ Dólares (USD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* KPI principal */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>KPI principal del dashboard</Label>
                  <HelpTooltip text="Qué número querés ver como el más destacado en tu dashboard. Runway es ideal para freelancers con ingresos irregulares." />
                </div>
                <Select value={primaryKpi} onValueChange={setPrimaryKpi}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="runway">Runway (meses de autonomía)</SelectItem>
                    <SelectItem value="savings_rate">Tasa de ahorro (%)</SelectItem>
                    <SelectItem value="net_worth">Patrimonio neto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
                {saveMutation.isPending ? <LoadingSpinner size="sm" /> : <><Save className="h-4 w-4 mr-2" /> Guardar cambios</>}
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* === PRIVACIDAD === */}
        <section className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Privacidad</h3>
          <Card className="border-border/50">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {hideAmounts ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                  <div>
                    <span className="text-sm">Ocultar montos</span>
                    <p className="text-xs text-muted-foreground">Los saldos se reemplazan por ••••••</p>
                  </div>
                </div>
                <Switch checked={hideAmounts} onCheckedChange={toggleHideAmounts} />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* === CATEGORÍAS ESENCIALES === */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categorías esenciales</h3>
              <HelpTooltip text="Las categorías marcadas como esenciales se usan para calcular tu costo de vida fijo. Marcá solo las que son gastos obligatorios." />
            </div>
            <Link to="/categories" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          <Card className="border-border/50">
            <CardContent className="p-0 divide-y divide-border">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm">{cat.name}</span>
                  </div>
                  <Switch
                    checked={cat.is_essential}
                    onCheckedChange={(checked) => toggleEssentialMutation.mutate({ id: cat.id, isEssential: checked })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* === DATOS === */}
        <section className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Datos</h3>
          <Card className="border-border/50">
            <CardContent className="p-0">
              <button
                onClick={handleExportData}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/50 transition-colors"
              >
                <Download className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="text-sm">Exportar mis datos</span>
                  <p className="text-xs text-muted-foreground">Descargá todas tus cuentas, movimientos y recurrentes en JSON</p>
                </div>
              </button>
              <div className="border-t border-border" />
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-destructive/5 transition-colors"
              >
                <Trash2 className="h-5 w-5 text-destructive" />
                <div>
                  <span className="text-sm text-destructive">Borrar mi cuenta</span>
                  <p className="text-xs text-muted-foreground">Elimina tu cuenta y todos tus datos permanentemente</p>
                </div>
              </button>
            </CardContent>
          </Card>
        </section>

        {/* === APLICACIÓN === */}
        <section className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Aplicación</h3>
          <Card className="border-border/50">
            <CardContent className="p-0">
              <button
                onClick={() => setIsPWADialogOpen(true)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/50 transition-colors"
              >
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="text-sm">Instalar aplicación</span>
                  <p className="text-xs text-muted-foreground">Agrega Finance Pro a tu pantalla de inicio</p>
                </div>
              </button>
              <div className="border-t border-border" />
              <div className="flex items-center gap-3 p-4">
                <Info className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="text-sm">Finance Pro v1.0.0</span>
                  <p className="text-xs text-muted-foreground">Tu copiloto financiero para Argentina</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* === CERRAR SESIÓN === */}
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </Button>
      </div>

      <InstallPWADialog open={isPWADialogOpen} onOpenChange={setIsPWADialogOpen} />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar tu cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es irreversible. Se eliminarán todas tus cuentas, movimientos, recurrentes, metas y configuración. Recomendamos exportar tus datos antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                toast({ title: 'Contactá soporte para borrar tu cuenta', description: 'Por seguridad, la eliminación de cuenta requiere confirmación manual.' });
                setShowDeleteConfirm(false);
              }}
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
