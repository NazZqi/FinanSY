import React from 'react';
import { HeroUIProvider } from '@heroui/react';
import { Shield } from 'lucide-react';
import { InstallmentsProvider } from './context/InstallmentsContext';
import { NavigationTabs } from './components/NavigationTabs';

export const App: React.FC = () => {
  return (
    <HeroUIProvider>
      <InstallmentsProvider>
        <div className="dark min-h-screen text-foreground bg-transparent flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-300">
          {/* Barra de Navegación Superior */}
          <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-default-200/50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-xl tracking-tight text-white">
                      Finan<span className="text-emerald-400">SY</span>
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      v2.0
                    </span>
                  </div>
                  <p className="text-[11px] text-default-400 font-medium hidden sm:block">
                    Asistente Preventivo de Compras a Plazos
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-default-400 hidden md:inline">
                  Sistema de Amortización Francés
                </span>
              </div>
            </div>
          </header>

          {/* Contenedor Principal con Pestañas y Vistas */}
          <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
            <NavigationTabs />
          </main>

          {/* Pie de Página */}
          <footer className="border-t border-default-200/40 bg-background/40 py-6 mt-12 text-center text-xs text-default-400">
            <div className="max-w-5xl mx-auto px-4 space-y-1">
              <p className="font-medium text-default-300">
                FinanSY • Herramienta de Apoyo Financiero Preventivo
              </p>
              <p className="text-[11px]">
                Fórmulas de amortización francesa de cuota fija • Criterio de semáforo prudencial
              </p>
              <p className="text-[11px] max-w-2xl mx-auto">
                <strong>Aviso:</strong> FinanSY es una herramienta informativa y referencial. No
                constituye asesoría financiera, legal ni oferta de crédito. Los resultados son
                estimaciones y pueden diferir del Costo Total del Crédito informado por la entidad
                financiera.
              </p>
              <details className="text-[11px] max-w-2xl mx-auto text-left">
                <summary className="cursor-pointer text-center text-default-300 font-medium">
                  Privacidad
                </summary>
                <p className="mt-1">
                  FinanSY no tiene servidores ni cuentas. Los datos que ingresas (ingresos, compras y
                  cuotas) se guardan solo en este navegador mediante almacenamiento local, no se
                  envían a terceros y no se usan cookies ni analítica. Puedes borrarlos limpiando los
                  datos del sitio en tu navegador.
                </p>
              </details>
            </div>
          </footer>
        </div>
      </InstallmentsProvider>
    </HeroUIProvider>
  );
};

export default App;
