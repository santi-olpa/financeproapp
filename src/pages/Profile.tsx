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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Eye,
  EyeOff,
  Smartphone,
  Save,
  Trash2,
  Download,
  Info,
  Moon,
  Sun,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Currency, Category } from '@/types/finance';

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { hideAmounts, toggleHideAmounts } = usePrivacy();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isPWADialogOpen, setIsPWADialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [fullName, setFullName] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>('ARS');
  const [primaryKpi, setPrimaryKpi] = useState('runway');
  const [nameInitialized, setNameInitialized] = useState(false);

  if (profile && !nameInitialized) {
    setFullName(profile.full_name || '');
    setDefaultCurrency(profile.default_currency);
    setPrimaryKpi(profile.primary_kpi);
    setNameInitialized(true);
  }

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName || null, default_currency: defaultCurrency, primary_kpi: primaryKpi })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ title: 'Perfil actualizado' });
    },
    onError: () => toast({ title: 'Error al guardar', variant: 'destructive' }),
  });

  const toggleEssentialMutation = useMutation({
    mutationFn: async ({ id, isEssential }: { id: string; isEssential: boolean }) => {
      const { error } = await supabase.from('categories').update({ is_essential: isEssential }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });

  const handleExportData = async () => {
    try {
      const [txRes, accRes, recRes] = await Promise.all([
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('accounts').select('*'),
        supabase.from('recurring_expenses').select('*'),
      ]);
      const data = { exported_at: new Date().toISOString(), accounts: accRes.data ?? [], transactions: txRes.data ?? [], recurring_expenses: recRes.data ?? [] };
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

      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        {/* Header con avatar */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="h-14 w-14">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg">
              {getInitials(profile?.full_name || null, user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold truncate">{profile?.full_name || 'Usuario'}</h2>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button variant="outline" size="sm" className="text-destructive shrink-0" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-1" /> Salir
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile">
          <TabsList className="w-full sm:w-auto mb-6">
            <TabsTrigger value="profile" className="flex-1 sm:flex-none">Perfil</TabsTrigger>
            <TabsTrigger value="preferences" className="flex-1 sm:flex-none">Preferencias</TabsTrigger>
            <TabsTrigger value="categories" className="flex-1 sm:flex-none">Categorías</TabsTrigger>
            <TabsTrigger value="data" className="flex-1 sm:flex-none">Datos</TabsTrigger>
          </TabsList>

          {/* === TAB PERFIL === */}
          <TabsContent value="profile" className="space-y-4">
            <Card className="border-border/50">
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tu nombre" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Moneda principal</Label>
                    <HelpTooltip text="La moneda que se muestra por defecto en el dashboard y reportes." />
                  </div>
                  <Select value={defaultCurrency} onValueChange={(v) => setDefaultCurrency(v as Currency)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">$ Pesos Argentinos (ARS)</SelectItem>
                      <SelectItem value="USD">US$ Dólares (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>KPI principal del dashboard</Label>
                    <HelpTooltip text="Qué número querés ver como el más destacado en tu dashboard. Runway es ideal para freelancers." />
                  </div>
                  <Select value={primaryKpi} onValueChange={setPrimaryKpi}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
          </TabsContent>

          {/* === TAB PREFERENCIAS === */}
          <TabsContent value="preferences" className="space-y-4">
            {/* Privacidad */}
            <Card className="border-border/50">
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    {hideAmounts ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                    <div>
                      <span className="text-sm font-medium">Ocultar montos</span>
                      <p className="text-xs text-muted-foreground">Los saldos se reemplazan por ••••••</p>
                    </div>
                  </div>
                  <Switch checked={hideAmounts} onCheckedChange={toggleHideAmounts} />
                </div>
              </CardContent>
            </Card>

            {/* Tema */}
            <Card className="border-border/50">
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? <Moon className="h-5 w-5 text-muted-foreground" /> : <Sun className="h-5 w-5 text-muted-foreground" />}
                    <div>
                      <span className="text-sm font-medium">Modo oscuro</span>
                      <p className="text-xs text-muted-foreground">Cambiá entre tema claro y oscuro</p>
                    </div>
                  </div>
                  <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
                </div>
              </CardContent>
            </Card>

            {/* Instalar PWA */}
            <Card className="border-border/50">
              <CardContent className="p-0">
                <button
                  onClick={() => setIsPWADialogOpen(true)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/50 transition-colors rounded-lg"
                >
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <span className="text-sm font-medium">Instalar aplicación</span>
                    <p className="text-xs text-muted-foreground">Agrega Finance Pro a tu pantalla de inicio</p>
                  </div>
                </button>
              </CardContent>
            </Card>

            {/* Info app */}
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <Info className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">Finance Pro v1.0.0</span>
                  <p className="text-xs text-muted-foreground">Tu copiloto financiero para Argentina</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === TAB CATEGORÍAS === */}
          <TabsContent value="categories" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Marcá cuáles son gastos esenciales (obligatorios).</p>
                <HelpTooltip text="Las categorías esenciales se usan para calcular tu costo de vida fijo. Marcá solo las que son gastos que no podés evitar." />
              </div>
              <Link to="/categories" className="text-xs text-primary hover:underline shrink-0">Gestionar todas</Link>
            </div>

            <Card className="border-border/50">
              <CardContent className="p-0 divide-y divide-border">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
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
          </TabsContent>

          {/* === TAB DATOS === */}
          <TabsContent value="data" className="space-y-4">
            <Card className="border-border/50">
              <CardContent className="p-0">
                <button
                  onClick={handleExportData}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/50 transition-colors rounded-t-lg"
                >
                  <Download className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <span className="text-sm font-medium">Exportar mis datos</span>
                    <p className="text-xs text-muted-foreground">Descargá cuentas, movimientos y recurrentes en JSON</p>
                  </div>
                </button>
                <div className="border-t border-border" />
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-destructive/5 transition-colors rounded-b-lg"
                >
                  <Trash2 className="h-5 w-5 text-destructive" />
                  <div>
                    <span className="text-sm text-destructive font-medium">Borrar mi cuenta</span>
                    <p className="text-xs text-muted-foreground">Elimina tu cuenta y todos tus datos permanentemente</p>
                  </div>
                </button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
                toast({ title: 'Contactá soporte para borrar tu cuenta', description: 'Por seguridad, la eliminación requiere confirmación manual.' });
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
