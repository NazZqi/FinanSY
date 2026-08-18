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
      <div className="flex justify-center px-4">
        <Tabs
          selectedKey={selectedTab}
          onSelectionChange={(key) => setSelectedTab(key as string)}
          aria-label="Pestañas de Navegación de FinanSY"
          color="primary"
          variant="bordered"
          classNames={{
            tabList: 'bg-background/80 backdrop-blur-xl border border-default-200/80 p-1.5 rounded-2xl shadow-lg',
            cursor: 'bg-primary shadow-lg shadow-primary/30 rounded-xl',
            tab: 'h-11 px-4 sm:px-6 text-xs sm:text-sm font-bold transition-all',
            tabContent: 'group-data-[selected=true]:text-primary-foreground font-semibold',
          }}
        >
          <Tab
            key="simulator"
            title={
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                <span>Simulador de Cuotas</span>
              </div>
            }
          />
          <Tab
            key="calendar"
            title={
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Calendario & Cuotas</span>
              </div>
            }
          />
          <Tab
            key="liquidity"
            title={
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
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
