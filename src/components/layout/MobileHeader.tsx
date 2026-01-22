import { ReactNode } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { ArrowLeft, Menu, Bell, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/types/finance';
import { MobileSidebarContent } from './MobileSidebarContent';
import { Link } from 'react-router-dom';

interface MobileHeaderProps {
  action?: ReactNode;
}

// Map routes to titles
const routeTitles: Record<string, string> = {
  '/dashboard': 'home', // Special case for greeting
  '/accounts': 'Cuentas',
  '/accounts/new': 'Nueva Cuenta',
  '/transactions': 'Movimientos',
  '/transactions/new': 'Nuevo Movimiento',
  '/expenses': 'Gastos',
  '/categories': 'Categorías',
  '/reports': 'Reportes',
  '/profile': 'Perfil',
};

export function MobileHeader({ action }: MobileHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
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

  const currentPath = location.pathname;
  const isHome = currentPath === '/dashboard' || currentPath === '/';
  
  // Find the best matching title
  let title = 'Finance Pro';
  let showBack = false;
  
  if (routeTitles[currentPath]) {
    title = routeTitles[currentPath];
  } else {
    // Check for dynamic routes
    if (currentPath.startsWith('/accounts/') && currentPath !== '/accounts/new') {
      title = 'Detalle de Cuenta';
      showBack = true;
    } else if (currentPath.startsWith('/transactions/')) {
      title = 'Detalle';
      showBack = true;
    } else {
      // For any nested route, show back button
      const segments = currentPath.split('/').filter(Boolean);
      if (segments.length > 1) {
        showBack = true;
        title = routeTitles['/' + segments[0]] || 'Detalle';
      }
    }
  }

  const getInitials = (name: string | null, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || 'U';
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'Usuario';

  return (
    <header className="sticky top-0 z-40 glass-strong safe-top">
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-3">
          {isHome ? (
            // Home: Avatar + Greeting
            <>
              <Sheet>
                <SheetTrigger asChild>
                  <button className="focus:outline-none focus:ring-2 focus:ring-primary rounded-full">
                    <Avatar className="h-10 w-10 border-2 border-primary/20">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {getInitials(profile?.full_name || null, user?.email)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <MobileSidebarContent profile={profile} userEmail={user?.email} />
                </SheetContent>
              </Sheet>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  Hola, {firstName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Bienvenido de vuelta
                </p>
              </div>
            </>
          ) : (
            // Other pages: Back button/Menu + Title
            <>
              {showBack ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className="shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              ) : (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-72 p-0">
                    <MobileSidebarContent profile={profile} userEmail={user?.email} />
                  </SheetContent>
                </Sheet>
              )}
              <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isHome && (
            <>
              <Link to="/transactions/new">
                <Button size="icon" className="rounded-full h-9 w-9">
                  <Plus className="h-4 w-4" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" className="text-muted-foreground h-9 w-9">
                <Bell className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
