import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Smartphone, Share, Plus, MoreVertical, Download } from 'lucide-react';

interface InstallPWADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Platform = 'ios' | 'android' | 'desktop' | 'unknown';

function detectPlatform(): Platform {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'ios';
  }
  if (/android/.test(userAgent)) {
    return 'android';
  }
  if (/windows|macintosh|linux/.test(userAgent) && !/mobile/.test(userAgent)) {
    return 'desktop';
  }
  return 'unknown';
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
}

export function InstallPWADialog({ open, onOpenChange }: InstallPWADialogProps) {
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsInstalled(isStandalone());
  }, []);

  if (isInstalled) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              App Instalada
            </DialogTitle>
            <DialogDescription>
              ¡Finance Pro ya está instalado en tu dispositivo!
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Puedes acceder a la app desde el icono en tu pantalla de inicio.
            </p>
          </div>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Entendido
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Instalar Finance Pro
          </DialogTitle>
          <DialogDescription>
            Instala la app en tu dispositivo para acceder más rápido
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {platform === 'ios' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                  1
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Toca el botón Compartir</p>
                  <p className="text-xs text-muted-foreground">
                    En la barra inferior de Safari
                  </p>
                </div>
                <Share className="h-6 w-6 text-muted-foreground" />
              </div>

              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                  2
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Selecciona "Agregar a Inicio"</p>
                  <p className="text-xs text-muted-foreground">
                    Desliza hacia abajo en el menú
                  </p>
                </div>
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>

              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                  3
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Confirma "Agregar"</p>
                  <p className="text-xs text-muted-foreground">
                    Toca en la esquina superior derecha
                  </p>
                </div>
              </div>
            </div>
          )}

          {platform === 'android' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                  1
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Toca el menú del navegador</p>
                  <p className="text-xs text-muted-foreground">
                    Los tres puntos en la esquina superior
                  </p>
                </div>
                <MoreVertical className="h-6 w-6 text-muted-foreground" />
              </div>

              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                  2
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Selecciona "Instalar aplicación"</p>
                  <p className="text-xs text-muted-foreground">
                    O "Agregar a pantalla de inicio"
                  </p>
                </div>
                <Download className="h-6 w-6 text-muted-foreground" />
              </div>

              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                  3
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Confirma la instalación</p>
                  <p className="text-xs text-muted-foreground">
                    Toca "Instalar" en el diálogo
                  </p>
                </div>
              </div>
            </div>
          )}

          {(platform === 'desktop' || platform === 'unknown') && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Esta aplicación puede instalarse en tu dispositivo para un acceso más rápido.
              </p>
              
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                  1
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Busca el ícono de instalación</p>
                  <p className="text-xs text-muted-foreground">
                    En la barra de direcciones de tu navegador
                  </p>
                </div>
                <Download className="h-6 w-6 text-muted-foreground" />
              </div>

              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                  2
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Haz clic en "Instalar"</p>
                  <p className="text-xs text-muted-foreground">
                    Se abrirá un diálogo de confirmación
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
            <h4 className="text-sm font-medium mb-2">Beneficios de instalar</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Acceso rápido desde tu pantalla de inicio</li>
              <li>• Funciona sin conexión a internet</li>
              <li>• Experiencia de app nativa</li>
              <li>• Carga más rápida</li>
            </ul>
          </div>
        </div>

        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
          Cerrar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
