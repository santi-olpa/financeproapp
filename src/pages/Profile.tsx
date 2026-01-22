import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { LogOut, User, Settings, HelpCircle, Smartphone, Eye, EyeOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePrivacy } from '@/hooks/usePrivacy';
import { InstallPWADialog } from '@/components/pwa/InstallPWADialog';
import type { Profile } from '@/types/finance';

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { hideAmounts, toggleHideAmounts } = usePrivacy();
  const [isPWADialogOpen, setIsPWADialogOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user,
  });

  const getInitials = (name: string | null, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || 'U';
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Perfil" />

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        {/* User info */}
        <Card className="glass border-border/50">
          <CardContent className="p-6 flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {getInitials(profile?.full_name || null, user?.email)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {profile?.full_name || 'Usuario'}
              </h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground px-1">Privacidad</h3>
          <Card className="glass border-border/50">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {hideAmounts ? (
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Eye className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <span className="text-foreground">Ocultar montos</span>
                    <p className="text-xs text-muted-foreground">
                      Los saldos e ingresos se mostrarán ocultos
                    </p>
                  </div>
                </div>
                <Switch
                  checked={hideAmounts}
                  onCheckedChange={toggleHideAmounts}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* App Settings */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground px-1">Aplicación</h3>
          <Card className="glass border-border/50">
            <CardContent className="p-0">
              <button 
                onClick={() => setIsPWADialogOpen(true)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/50 transition-colors"
              >
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="text-foreground">Instalar aplicación</span>
                  <p className="text-xs text-muted-foreground">
                    Agrega Finance Pro a tu pantalla de inicio
                  </p>
                </div>
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Options */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground px-1">Cuenta</h3>
          <Card className="glass border-border/50">
            <CardContent className="p-0">
              <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/50 transition-colors">
                <User className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">Editar perfil</span>
              </button>
              <div className="border-t border-border" />
              <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/50 transition-colors">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">Configuración</span>
              </button>
              <div className="border-t border-border" />
              <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/50 transition-colors">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">Ayuda</span>
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Sign out */}
        <Button 
          variant="outline" 
          className="w-full text-destructive hover:text-destructive"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </Button>

        {/* Version */}
        <p className="text-center text-xs text-muted-foreground">
          Finance Pro v1.0.0
        </p>
      </div>

      <InstallPWADialog 
        open={isPWADialogOpen} 
        onOpenChange={setIsPWADialogOpen} 
      />
    </div>
  );
}
