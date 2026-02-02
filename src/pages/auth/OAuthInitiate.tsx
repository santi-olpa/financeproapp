import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Lovable Cloud OAuth broker entry page.
 *
 * The cloud-auth-js library redirects the browser here (default: /~oauth/initiate).
 * In SPA deployments, we must provide a matching route so React Router doesn't 404.
 *
 * We forward the same query params to the backend /authorize endpoint.
 */
export default function OAuthInitiate() {
  const [error, setError] = useState<string | null>(null);

  const search = useMemo(() => window.location.search || "", []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const provider = params.get("provider");

      if (!provider) {
        setError("Falta el parámetro 'provider'.");
        return;
      }

      // Hand off to the backend OAuth endpoint.
      window.location.replace(`/authorize${search}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el flujo OAuth.");
    }
  }, [search]);

  if (!error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Conectando…</CardTitle>
            <CardDescription>
              Estamos iniciando el acceso con Google. Si no avanza, vuelve atrás y reintenta.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button variant="outline" onClick={() => window.history.back()}>
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
 
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>No se pudo iniciar sesión</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end">
          <Button onClick={() => (window.location.href = "/login")}>Ir a Login</Button>
        </CardContent>
      </Card>
    </div>
  );
}
