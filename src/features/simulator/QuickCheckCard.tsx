import React from 'react';
import { Card, CardBody, Chip, Progress, Button } from '@heroui/react';
import { ShieldCheck, AlertTriangle, AlertOctagon, TrendingUp, CheckCircle2 } from 'lucide-react';
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
    <Card className={`border ${status.borderColor} ${status.bgColor} backdrop-blur-xl shadow-xl transition-all duration-300`}>
      <CardBody className="p-6 space-y-6">
        {/* Header con Estado y Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-default-100 border border-default-200">
              {status.icon}
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-default-400 font-semibold">
                Veredicto Semafórico
              </span>
              <h3 className="text-lg font-bold text-foreground">{status.title}</h3>
            </div>
          </div>
          <Chip
            color={status.chipColor}
            variant="flat"
            size="lg"
            className="capitalize font-semibold self-start sm:self-auto"
          >
            {result.estadoSemaforo === 'green' ? '🟢 Recomendado' : result.estadoSemaforo === 'yellow' ? '🟡 Precaución' : '🔴 Alto Riesgo'}
          </Chip>
        </div>

        <p className="text-sm text-default-300 leading-relaxed">{status.desc}</p>

        {/* Barra de Progreso de Impacto */}
        <div className="space-y-2 bg-default-50/50 p-4 rounded-xl border border-default-100">
          <div className="flex justify-between text-sm">
            <span className="text-default-400 font-medium">Impacto en Ingreso Estimado:</span>
            <span className="font-bold text-foreground">
              {formatPercent(result.impactoIngresoPorcentaje)}
            </span>
          </div>
          <Progress
            value={Math.min(100, result.impactoIngresoPorcentaje)}
            color={status.chipColor}
            className="max-w-full h-2.5"
          />
          <div className="flex justify-between text-[11px] text-default-400 font-mono">
            <span>0% (Óptimo)</span>
            <span>15% (Límite Verde)</span>
            <span>30% (Límite Amarillo)</span>
            <span>50%+</span>
          </div>
        </div>

        {/* Métricas Clave */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-default-100/60 border border-default-200/50">
            <div className="text-xs text-default-400 font-medium">Cuota Mensual Final</div>
            <div className="text-xl font-extrabold text-foreground mt-0.5">
              {formatCurrency(result.cuotaMensual)}
            </div>
            <div className="text-[11px] text-default-400">
              x {input.numeroCuotas} meses
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-default-100/60 border border-default-200/50">
            <div className="text-xs text-default-400 font-medium">Costo Total Financiero</div>
            <div className="text-xl font-extrabold text-foreground mt-0.5">
              {formatCurrency(result.costoTotalFinanciero)}
            </div>
            <div className="text-[11px] text-default-400">
              Monto + Intereses + Costos
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-default-100/60 border border-default-200/50 col-span-2 sm:col-span-1">
            <div className="text-xs text-default-400 font-medium">Sobrecosto Total</div>
            <div className={`text-xl font-extrabold mt-0.5 ${result.sobrecostoTotal > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              +{formatCurrency(result.sobrecostoTotal)}
            </div>
            <div className="text-[11px] text-default-400">
              {result.sobrecostoTotal > 0
                ? `${formatPercent((result.sobrecostoTotal / input.montoTotal) * 100)} del precio original`
                : 'Sin sobrecosto adicional'}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {onViewAmortization && (
            <Button
              variant="flat"
              color="default"
              className="flex-1 font-semibold"
              startContent={<TrendingUp className="w-4 h-4" />}
              onPress={onViewAmortization}
            >
              Ver Tabla de Amortización
            </Button>
          )}

          {onSaveToActive && (
            <Button
              variant="solid"
              color="primary"
              className="flex-1 font-semibold shadow-lg shadow-primary/20"
              startContent={<CheckCircle2 className="w-4 h-4" />}
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
