import React from 'react';
import { Card, CardBody, Chip, Progress, Button, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { ShieldCheck, AlertTriangle, AlertOctagon, TrendingUp, PlusCircle, HelpCircle } from 'lucide-react';
import { SimulationResult, PurchaseSimulationInput } from '../../types/finance';
import { formatCurrency, formatPercent } from '../../utils/amortization';

interface QuickCheckCardProps {
  result: SimulationResult;
  input: PurchaseSimulationInput;
  onSaveToActive?: () => void;
  onViewAmortization?: () => void;
}

export const QuickCheckCard: React.FC<QuickCheckCardProps> = ({
  result,
  input,
  onSaveToActive,
  onViewAmortization,
}) => {
  const getStatusBadge = () => {
    switch (result.estadoSemaforo) {
      case 'green':
        return {
          chipColor: 'success' as const,
          icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
          title: 'Compra Viable / Bajo Riesgo',
          desc: `La cuota mensual compromete el ${formatPercent(result.impactoIngresoPorcentaje)} de tu ingreso estimado (≤ 15%). Flujo de caja seguro.`,
          borderColor: 'border-emerald-500/30',
          bgColor: 'bg-emerald-950/20',
        };
      case 'yellow':
        return {
          chipColor: 'warning' as const,
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          title: 'Precaución / Carga Media',
          desc: `La cuota compromete el ${formatPercent(result.impactoIngresoPorcentaje)} de tus ingresos (15% - 30%). Ajusta gastos variables antes de comprometerte.`,
          borderColor: 'border-amber-500/30',
          bgColor: 'bg-amber-950/20',
        };
      case 'red':
      default:
        return {
          chipColor: 'danger' as const,
          icon: <AlertOctagon className="w-5 h-5 text-rose-400" />,
          title: 'Alto Riesgo de Sobreendeudamiento',
          desc: `La cuota absorbe el ${formatPercent(result.impactoIngresoPorcentaje)} de tu ingreso (> 30%). No recomendada sin renegociar plazo o ahorrar previamente.`,
          borderColor: 'border-rose-500/30',
          bgColor: 'bg-rose-950/20',
        };
    }
  };

  const status = getStatusBadge();

  return (
    <Card className={`border ${status.borderColor} ${status.bgColor} backdrop-blur-xl shadow-lg transition-all duration-300 h-full flex flex-col justify-between`}>
      <CardBody className="p-6 space-y-5 flex flex-col justify-between h-full">
        {/* Header con Estado, Icono centrado, Tooltip de Viabilidad y Badge */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-default-100/90 border border-default-200/80 flex items-center justify-center shrink-0 shadow-sm">
                {status.icon}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-default-400 font-bold">
                    Veredicto Semafórico
                  </span>
                  <Popover placement="bottom" showArrow backdrop="opaque">
                    <PopoverTrigger>
                      <button
                        type="button"
                        aria-label="Criterio de Viabilidad"
                        className="text-default-400 hover:text-emerald-400 transition-colors p-0.5 rounded focus:outline-none"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="p-4 max-w-xs bg-background/95 border border-default-200/80 shadow-xl rounded-xl">
                      <div className="space-y-2 text-xs">
                        <div className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                          <span className="text-emerald-400 font-bold">🛡️</span> Criterios de Viabilidad FinanSY
                        </div>
                        <ul className="space-y-1.5 text-default-300 text-[11px]">
                          <li>
                            <strong className="text-emerald-400">Verde (≤ 15%):</strong> Compra segura que no compromete tu fondo de emergencia.
                          </li>
                          <li>
                            <strong className="text-amber-400">Amarillo (15% - 30%):</strong> Carga moderada; requiere cautela en gastos discrecionales.
                          </li>
                          <li>
                            <strong className="text-rose-400">Rojo (&gt; 30%):</strong> Riesgo inminente de estrés de liquidez.
                          </li>
                        </ul>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <h3 className="text-base font-bold text-foreground">{status.title}</h3>
              </div>
            </div>
            <Chip
              color={status.chipColor}
              variant="flat"
              size="md"
              className="font-bold self-start sm:self-auto shrink-0"
            >
              {result.estadoSemaforo === 'green' ? '🟢 Recomendado' : result.estadoSemaforo === 'yellow' ? '🟡 Precaución' : '🔴 Alto Riesgo'}
            </Chip>
          </div>

          <p className="text-xs text-default-300 leading-relaxed">{status.desc}</p>

          {/* Barra de Progreso de Impacto */}
          <div className="space-y-2 bg-default-100/40 p-3.5 rounded-xl border border-default-200/50">
            <div className="flex justify-between text-xs">
              <span className="text-default-400 font-medium">Impacto en Ingreso Estimado:</span>
              <span className="font-bold text-foreground font-mono">
                {formatPercent(result.impactoIngresoPorcentaje)}
              </span>
            </div>
            <Progress
              value={Math.min(100, result.impactoIngresoPorcentaje)}
              color={status.chipColor}
              className="max-w-full h-2 rounded-full"
            />
            <div className="flex justify-between text-[10px] text-default-400 font-mono">
              <span>0% (Óptimo)</span>
              <span>15% (Límite Verde)</span>
              <span>30% (Límite Amarillo)</span>
              <span>50%+</span>
            </div>
          </div>

          {/* Métricas Clave */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-default-100/60 border border-default-200/50">
              <div className="text-[11px] text-default-400 font-medium">Cuota Mensual</div>
              <div className="text-lg font-black text-foreground mt-0.5 font-mono">
                {formatCurrency(result.cuotaMensual)}
              </div>
              <div className="text-[10px] text-default-400">
                x {input.numeroCuotas} meses
              </div>
            </div>

            <div className="p-3 rounded-xl bg-default-100/60 border border-default-200/50">
              <div className="text-[11px] text-default-400 font-medium">Costo Total</div>
              <div className="text-lg font-black text-foreground mt-0.5 font-mono">
                {formatCurrency(result.costoTotalFinanciero)}
              </div>
              <div className="text-[10px] text-default-400">
                Capital + Interés + Costos
              </div>
            </div>

            <div className="p-3 rounded-xl bg-default-100/60 border border-default-200/50 col-span-2 sm:col-span-1">
              <div className="text-[11px] text-default-400 font-medium">Sobrecosto Total</div>
              <div className={`text-lg font-black mt-0.5 font-mono ${result.sobrecostoTotal > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                +{formatCurrency(result.sobrecostoTotal)}
              </div>
              <div className="text-[10px] text-default-400">
                {result.sobrecostoTotal > 0 && input.montoTotal > 0
                  ? `${formatPercent((result.sobrecostoTotal / input.montoTotal) * 100)} adicional`
                  : '0% de interés'}
              </div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-default-200/40">
          {onViewAmortization && (
            <Button
              variant="bordered"
              color="default"
              className="w-full font-semibold border-default-200/80 hover:bg-default-100/70 text-xs h-10 transition-colors"
              startContent={<TrendingUp className="w-4 h-4 text-primary shrink-0" />}
              onPress={onViewAmortization}
            >
              Ver Tabla de Amortización
            </Button>
          )}

          {onSaveToActive && (
            <Button
              variant="solid"
              color="primary"
              className="w-full font-bold shadow-md shadow-emerald-500/20 text-xs h-10"
              startContent={<PlusCircle className="w-4 h-4 shrink-0" />}
              onPress={onSaveToActive}
            >
              Guardar en Cuotas Activas
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

