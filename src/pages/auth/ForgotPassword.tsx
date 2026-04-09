import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Wallet, Mail, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="rounded-full bg-primary/10 p-4 mb-4">
            <Wallet className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Finance Pro</h1>
        </div>

        <Card className="border-border/50">
          {sent ? (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto rounded-full bg-income/10 p-3 mb-3 w-14 h-14 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-income" />
                </div>
                <CardTitle>Revisá tu email</CardTitle>
                <CardDescription>
                  Si hay una cuenta asociada a <strong>{email}</strong>, te enviamos un link para restablecer tu contraseña.
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-center">
                <Link to="/login" className="text-sm text-primary hover:underline">
                  Volver al login
                </Link>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Restablecer contraseña</CardTitle>
                <CardDescription>
                  Ingresá tu email y te enviamos un link para crear una contraseña nueva.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <LoadingSpinner size="sm" /> : 'Enviar link'}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="flex justify-center">
                <Link to="/login" className="text-sm text-muted-foreground hover:underline">
                  Volver al login
                </Link>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
