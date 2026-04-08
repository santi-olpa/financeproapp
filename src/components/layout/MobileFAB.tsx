import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Plus,
  X,
  TrendingDown,
  TrendingUp,
  ArrowLeftRight,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MobileFABProps = {
  onAiClick: () => void;
};

const actions = [
  { icon: TrendingDown, label: 'Egreso', path: '/transactions/new?type=expense', color: 'bg-expense text-white' },
  { icon: TrendingUp, label: 'Ingreso', path: '/transactions/new?type=income', color: 'bg-income text-white' },
  { icon: ArrowLeftRight, label: 'Transferencia', path: '/transactions/new?type=transfer', color: 'bg-warning text-white' },
  { icon: ShoppingBag, label: 'Cuotas', path: '/purchases/new', color: 'bg-primary text-white' },
];

export function MobileFAB({ onAiClick }: MobileFABProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleAction = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Actions menu — arriba del FAB con gap suficiente */}
      <div className="fixed bottom-[7.5rem] right-4 z-50 flex flex-col-reverse items-end gap-3 mb-2">
        {open && (
          <>
            {actions.map((action) => (
              <button
                key={action.path}
                onClick={() => handleAction(action.path)}
                className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
              >
                <span className="text-sm font-medium bg-card border border-border rounded-lg px-3 py-1.5 shadow-lg">
                  {action.label}
                </span>
                <div className={cn('w-11 h-11 rounded-full flex items-center justify-center shadow-lg', action.color)}>
                  <action.icon className="h-5 w-5" />
                </div>
              </button>
            ))}
            {/* AI Assistant */}
            <button
              onClick={() => { setOpen(false); onAiClick(); }}
              className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              <span className="text-sm font-medium bg-card border border-border rounded-lg px-3 py-1.5 shadow-lg">
                Asistente IA
              </span>
              <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg bg-card border border-primary text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
            </button>
          </>
        )}
      </div>

      {/* Main FAB */}
      <Button
        size="icon"
        className={cn(
          'fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full shadow-xl transition-transform',
          open ? 'rotate-45 bg-muted text-foreground hover:bg-muted' : 'bg-primary text-primary-foreground',
        )}
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </Button>
    </>
  );
}
