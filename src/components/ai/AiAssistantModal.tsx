import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  Mic, 
  Send, 
  Sparkles, 
  AlertCircle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Account, Category, TransactionType, Currency } from '@/types/finance';

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface AiAssistantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionParsed: (data: ParsedTransaction) => void;
}

export interface ParsedTransaction {
  amount: number;
  currency: Currency;
  type: TransactionType;
  description: string | null;
  accountId: string | null;
  accountName?: string;
  categoryId: string | null;
  categoryName?: string;
  sourceAccountId?: string | null;
  sourceAccountName?: string;
  destinationAccountId?: string | null;
  destinationAccountName?: string;
}

type AssistantState = 'idle' | 'listening' | 'processing' | 'success' | 'error';

export function AiAssistantModal({ 
  open, 
  onOpenChange, 
  onTransactionParsed 
}: AiAssistantModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [textInput, setTextInput] = useState('');
  const [state, setState] = useState<AssistantState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedTransaction | null>(null);
  const [isListening, setIsListening] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  // Check browser support for speech
  const isSpeechSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Initialize speech recognition (following the working example pattern)
  useEffect(() => {
    if (!isSpeechSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.lang = 'es-AR';
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setTextInput(transcript);
      setIsListening(false);
      setState('idle');
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setState('idle');
      
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setErrorMessage(`Error de micrófono: ${event.error}`);
        setState('error');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [isSpeechSupported]);

  // Fetch user accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, name, currency')
        .eq('is_active', true);
      if (error) throw error;
      return data as Pick<Account, 'id' | 'name' | 'currency'>[];
    },
    enabled: open && !!user,
  });

  // Fetch user categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, category_type');
      if (error) throw error;
      return data as Pick<Category, 'id' | 'name' | 'category_type'>[];
    },
    enabled: open && !!user,
  });

  // Reset state when modal opens/closes and STOP microphone when closing
  useEffect(() => {
    if (open) {
      setState('idle');
      setTextInput('');
      setErrorMessage('');
      setParsedResult(null);
      setIsListening(false);
    } else {
      // CRITICAL: Stop the microphone when modal closes
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore
        }
      }
      setIsListening(false);
    }
  }, [open]);

  const handleListen = () => {
    if (!recognitionRef.current) return;

    if (!isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setState('listening');
        setErrorMessage('');
      } catch (err) {
        console.error('Failed to start recognition:', err);
      }
    } else {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
        setState('idle');
      } catch (err) {
        console.error('Failed to stop recognition:', err);
      }
    }
  };

  const handleSubmit = async () => {
    const input = textInput.trim();
    if (!input) {
      toast({
        title: 'Error',
        description: 'Ingresa o dicta un movimiento.',
        variant: 'destructive',
      });
      return;
    }

    if (!accounts?.length) {
      toast({
        title: 'Error',
        description: 'Primero debes crear al menos una cuenta.',
        variant: 'destructive',
      });
      return;
    }

    // Stop listening if active
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
    }

    setState('processing');
    setErrorMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('ai-transaction-parser', {
        body: {
          userInput: input,
          accounts: accounts.map(a => ({ id: a.id, name: a.name, currency: a.currency })),
          categories: categories?.map(c => ({ id: c.id, name: c.name, category_type: c.category_type })) || [],
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.transaction) {
        throw new Error('No se pudo interpretar el movimiento');
      }

      setParsedResult(data.transaction);
      setState('success');

    } catch (err) {
      console.error('AI parsing error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Error al procesar');
      setState('error');
    }
  };

  const handleConfirm = () => {
    if (parsedResult) {
      onTransactionParsed(parsedResult);
      onOpenChange(false);
    }
  };

  const formatTransactionType = (type: TransactionType) => {
    switch (type) {
      case 'income': return 'Ingreso';
      case 'expense': return 'Egreso';
      case 'transfer': return 'Transferencia';
      default: return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="ai-assistant-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Asistente IA
          </DialogTitle>
          <DialogDescription id="ai-assistant-description">
            Describí tu movimiento con lenguaje natural para registrarlo rápidamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Example hint */}
          <p className="text-sm text-muted-foreground">
            Por ejemplo:
            <span className="block mt-1 italic text-foreground/80">
              "Pagué 15 mil de súper con Mercado Pago"
            </span>
          </p>

          {/* Input area - using simple input like the working example */}
          <div className="relative">
            <Input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
              placeholder="Cargá tu movimiento aquí..."
              className="pr-12"
              disabled={state === 'processing' || state === 'success'}
            />
            
            {/* Voice button - positioned inside input like the working example */}
            {isSpeechSupported && state !== 'processing' && state !== 'success' && (
              <button
                type="button"
                onClick={handleListen}
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 text-xl transition-colors",
                  isListening 
                    ? "text-destructive animate-pulse" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Mic className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Voice indicator */}
          {isListening && (
            <div className="flex items-center gap-2 text-sm text-destructive animate-pulse">
              <div className="h-2 w-2 rounded-full bg-destructive" />
              Escuchando... Habla ahora
            </div>
          )}

          {/* Processing state */}
          {state === 'processing' && (
            <div className="flex items-center justify-center gap-3 py-4">
              <LoadingSpinner size="sm" />
              <span className="text-sm text-muted-foreground">
                Interpretando movimiento...
              </span>
            </div>
          )}

          {/* Error state */}
          {state === 'error' && errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success state - Preview */}
          {state === 'success' && parsedResult && (
            <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <CheckCircle2 className="h-4 w-4" />
                Movimiento interpretado
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo:</span>
                  <span className="font-medium">{formatTransactionType(parsedResult.type)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monto:</span>
                  <span className="font-medium">
                    {parsedResult.currency === 'USD' ? 'US$ ' : '$ '}
                    {parsedResult.amount.toLocaleString('es-AR')}
                  </span>
                </div>
                {parsedResult.description && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Descripción:</span>
                    <span className="font-medium">{parsedResult.description}</span>
                  </div>
                )}
                {parsedResult.accountName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cuenta:</span>
                    <span className="font-medium">{parsedResult.accountName}</span>
                  </div>
                )}
                {parsedResult.categoryName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Categoría:</span>
                    <span className="font-medium">{parsedResult.categoryName}</span>
                  </div>
                )}
                {parsedResult.type === 'transfer' && (
                  <>
                    {parsedResult.sourceAccountName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Origen:</span>
                        <span className="font-medium">{parsedResult.sourceAccountName}</span>
                      </div>
                    )}
                    {parsedResult.destinationAccountName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Destino:</span>
                        <span className="font-medium">{parsedResult.destinationAccountName}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {state === 'success' ? (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setState('idle');
                    setParsedResult(null);
                  }}
                >
                  Corregir
                </Button>
                <Button className="flex-1 gap-2" onClick={handleConfirm}>
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                  disabled={state === 'processing'}
                >
                  Cancelar
                </Button>
                <Button 
                  className="flex-1 gap-2"
                  onClick={handleSubmit}
                  disabled={!textInput.trim() || state === 'processing'}
                >
                  {state === 'processing' ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Procesar
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
