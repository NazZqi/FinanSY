import React, { Suspense, lazy, useState } from 'react';
import { Tabs, Tab, Spinner } from '@heroui/react';
import { Calculator, Calendar, TrendingUp } from 'lucide-react';

// Carga diferida obligatoria por especificación técnica (code splitting)
const SimulatorView = lazy(() => import('../features/simulator/SimulatorView'));
const CalendarView = lazy(() => import('../features/calendar/CalendarView'));
const LiquidityView = lazy(() => import('../features/liquidity/LiquidityView'));

export const NavigationTabs: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<string>('simulator');

  return (
    <div className="w-full space-y-6">
      {/* Barra de Pestañas Centrada y Armonizada */}
      <div className="flex justify-center w-full">
        <Tabs
          selectedKey={selectedTab}
          onSelectionChange={(key) => setSelectedTab(key as string)}
          aria-label="Pestañas de Navegación de FinanSY"
          color="primary"
          variant="bordered"
          classNames={{
            base: 'w-full flex justify-center',
            tabList: 'bg-default-100/50 backdrop-blur-xl border border-default-200/70 p-1 rounded-2xl shadow-sm gap-1 w-full sm:w-auto max-w-full overflow-x-auto',
            cursor: 'bg-primary/90 shadow-md shadow-primary/25 rounded-xl',
            tab: 'h-10 px-3 sm:px-6 text-xs sm:text-sm font-semibold transition-all data-[selected=true]:font-bold',
            tabContent: 'group-data-[selected=true]:text-primary-foreground',
          }}
        >
          <Tab
            key="simulator"
            title={
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 shrink-0" />
                <span>Simulador de Cuotas</span>
              </div>
            }
          />
          <Tab
            key="calendar"
            title={
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>Calendario & Cuotas</span>
              </div>
            }
          />
          <Tab
            key="liquidity"
            title={
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span>Curva de Alivio</span>
              </div>
            }
          />
        </Tabs>
      </div>

      {/* Contenedor Suspense con Spinner de HeroUI como fallback */}
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 py-16">
            <Spinner size="lg" color="primary" label="Cargando módulo..." labelColor="primary" />
          </div>
        }
      >
        <div className="w-full transition-opacity duration-300">
          {selectedTab === 'simulator' && <SimulatorView />}
          {selectedTab === 'calendar' && <CalendarView />}
          {selectedTab === 'liquidity' && <LiquidityView />}
        </div>
      </Suspense>
    </div>
  );
};

export default NavigationTabs;
