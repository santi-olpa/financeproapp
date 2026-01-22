import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SheetClose } from '@/components/ui/sheet';
import { 
  LayoutDashboard, 
  Wallet, 
  ArrowLeftRight, 
  Receipt,
  Tags,
  BarChart3,
  User,
  LogOut,
  X
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { Profile } from '@/types/finance';

interface MobileSidebarContentProps {
  profile?: Profile | null;
  userEmail?: string;
}

const menuItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/accounts', icon: Wallet, label: 'Cuentas' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Movimientos' },
  { to: '/expenses', icon: Receipt, label: 'Gastos' },
  { to: '/categories', icon: Tags, label: 'Categorías' },
  { to: '/reports', icon: BarChart3, label: 'Reportes' },
];

export function MobileSidebarContent({ profile, userEmail }: MobileSidebarContentProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const getInitials = (name: string | null, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || 'U';
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header with profile */}
      <div className="p-6 bg-primary/5 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-bold text-primary">Finance Pro</span>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </div>
        
        <SheetClose asChild>
          <button 
            onClick={() => navigate('/profile')}
            className="flex items-center gap-3 w-full text-left"
          >
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(profile?.full_name || null, userEmail)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {profile?.full_name || 'Usuario'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {userEmail}
              </p>
            </div>
          </button>
        </SheetClose>
      </div>

      {/* Menu items */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map(({ to, icon: Icon, label }) => (
          <SheetClose asChild key={to}>
            <NavLink
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive 
                  ? 'bg-primary/10 text-primary font-medium' 
                  : 'text-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          </SheetClose>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-2">
        <SheetClose asChild>
          <NavLink
            to="/profile"
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
              isActive 
                ? 'bg-primary/10 text-primary font-medium' 
                : 'text-foreground hover:bg-muted'
            )}
          >
            <User className="h-5 w-5" />
            <span>Mi Perfil</span>
          </NavLink>
        </SheetClose>
        
        <button 
          onClick={signOut}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-destructive hover:bg-destructive/10 transition-colors w-full"
        >
          <LogOut className="h-5 w-5" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
}
