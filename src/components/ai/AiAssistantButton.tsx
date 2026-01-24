import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AiAssistantButtonProps {
  onClick: () => void;
  className?: string;
  variant?: 'default' | 'floating' | 'sidebar';
}

export function AiAssistantButton({ 
  onClick, 
  className,
  variant = 'default' 
}: AiAssistantButtonProps) {
  if (variant === 'floating') {
    return (
      <Button
        onClick={onClick}
        size="lg"
        className={cn(
          "fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg",
          "bg-gradient-to-br from-primary to-primary/80",
          "hover:scale-105 transition-transform",
          "md:bottom-6",
          className
        )}
      >
        <Sparkles className="h-6 w-6" />
        <span className="sr-only">Asistente IA</span>
      </Button>
    );
  }

  if (variant === 'sidebar') {
    return (
      <Button
        onClick={onClick}
        variant="ghost"
        className={cn(
          "w-full justify-start gap-3 text-muted-foreground hover:text-foreground",
          className
        )}
      >
        <Sparkles className="h-4 w-4" />
        <span>Asistente IA</span>
      </Button>
    );
  }

  return (
    <Button
      onClick={onClick}
      variant="outline"
      className={cn("gap-2", className)}
    >
      <Sparkles className="h-4 w-4" />
      Asistente IA
    </Button>
  );
}
