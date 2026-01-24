import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  Mic, 
  MicOff, 
  Send, 
  Sparkles, 
  AlertCircle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Account, Category, TransactionType, Currency } from '@/types/finance';

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

  const {
    transcript,
    isListening,
    isSupported: isSpeechSupported,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({ language: 'es-AR' });

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

  // Update text input from voice transcript
  useEffect(() => {
    if (transcript) {
      // Clean interim markers
      const cleanTranscript = transcript.replace(/\s*\[.*\]$/, '');
      setTextInput(cleanTranscript);
    }
  }, [transcript]);

  // Handle speech errors
  useEffect(() => {
    if (speechError) {
      setErrorMessage(speechError);
      setState('error');
    }
  }, [speechError]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setState('idle');
      setTextInput('');
      setErrorMessage('');
      setParsedResult(null);
      resetTranscript();
    }
  }, [open, resetTranscript]);

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
      setState('idle');
    } else {
      resetTranscript();
      setTextInput('');
      startListening();
      setState('listening');
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Asistente IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <p className="text-sm text-muted-foreground">
            Describí tu movimiento con lenguaje natural. Por ejemplo:
            <span className="block mt-1 italic text-foreground/80">
              "Pagué 15 mil de súper con Mercado Pago"
            </span>
          </p>

          {/* Input area */}
          <div className="relative">
            <Textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Escribí o dictá tu movimiento..."
              className="min-h-[100px] pr-12 resize-none"
              disabled={state === 'processing' || state === 'success'}
            />
            
            {/* Voice button */}
            {isSpeechSupported && state !== 'processing' && state !== 'success' && (
              <Button
                type="button"
                size="icon"
                variant={isListening ? 'default' : 'ghost'}
                className={cn(
                  "absolute bottom-2 right-2 h-8 w-8",
                  isListening && "animate-pulse bg-destructive hover:bg-destructive/90"
                )}
                onClick={handleVoiceToggle}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
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
