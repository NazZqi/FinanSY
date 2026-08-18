import React, { useMemo } from 'react';
import { Card, CardBody, CardHeader, Chip } from '@heroui/react';
import {
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useInstallments } from '../../context/InstallmentsContext';
import { MonthlyLiquidityProjection } from '../../types/finance';
import { formatCurrency, formatPercent } from '../../utils/amortization';

export const LiquidityView: React.FC = () => {
  const { purchases, estimatedIncome } = useInstallments();

  // Proyección de liquidez para los próximos 12 meses
  const projections: MonthlyLiquidityProjection[] = useMemo(() => {
    const monthNames = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
    ];
    const currentDate = new Date();
    const result: MonthlyLiquidityProjection[] = [];

    for (let offset = 0; offset < 12; offset++) {
      const targetDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + offset,
        1
      );
      const mesLabel = `${monthNames[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

      // Determinar qué cuotas siguen vigentes en este mes futuro
      let cuotasTotales = 0;
      let cuotasActivasCount = 0;

      purchases.forEach((p) => {
        const cuotasRestantes = p.numeroCuotas - p.cuotasPagadas;
        // Si aún faltan cuotas por pagar y el mes está dentro del horizonte restante
        if (cuotasRestantes > offset) {
          cuotasTotales += p.cuotaMensual;
          cuotasActivasCount += 1;
        }
      });

      const margenDisponible = Math.max(0, estimatedIncome - cuotasTotales);

      result.push({
        mes: mesLabel,
        cuotasTotales,
        margenDisponible,
        ingresoEstimado: estimatedIncome,
        cuotasActivasCount,
      });
    }

    return result;
  }, [purchases, estimatedIncome]);

  const currentCommitment = projections[0]?.cuotasTotales || 0;
  const finalMargin = projections[projections.length - 1]?.margenDisponible || estimatedIncome;

  // Identificar los meses en que se extingue cada deuda
  const debtFreeMilestones = useMemo(() => {
    return purchases
      .map((p) => {
        const remaining = p.numeroCuotas - p.cuotasPagadas;
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + remaining);
        return {
          id: p.id,
          descripcion: p.descripcion,
          remainingMonths: remaining,
          liberacionDate: targetDate.toLocaleDateString('es-CL', {
            month: 'long',
            year: 'numeric',
          }),
          cuotaLiberada: p.cuotaMensual,
        };
      })
      .filter((m) => m.remainingMonths > 0)
      .sort((a, b) => a.remainingMonths - b.remainingMonths);
  }, [purchases]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Encabezado y Proyección General */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-950/40 via-default-900/60 to-default-900/40 border border-blue-500/20 backdrop-blur-xl shadow-lg">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
            <TrendingUp className="w-3.5 h-3.5" /> Curva de Alivio y Proyección
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground">
            Recuperación Paulatina de Liquidez
          </h2>
          <p className="text-sm text-default-400 max-w-xl">
            Visualiza cómo aumenta tu flujo libre disponible conforme se van liquidando tus compras
            a plazos en los próximos 12 meses.
          </p>
        </div>

        <div className="bg-default-100/80 p-3.5 rounded-xl border border-default-200 min-w-[220px] text-right">
          <span className="text-xs text-default-400 font-medium">Margen Proyectado Mes 12</span>
          <div className="text-2xl font-black text-emerald-400">
            {formatCurrency(finalMargin)}
          </div>
          <span className="text-[11px] text-default-400">
            {currentCommitment > 0
              ? `+${formatCurrency(finalMargin - (estimatedIncome - currentCommitment))} recuperados/mes`
              : 'Flujo 100% liberado'}
          </span>
        </div>
      </div>

      {/* Gráfico Visual de Curva de Alivio (Barras Proyectadas) */}
      <Card className="border border-default-200/80 bg-background/70 backdrop-blur-xl shadow-lg">
        <CardHeader className="flex items-center justify-between px-6 pt-6 pb-2">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Proyección de Margen Disponible vs. Carga en Cuotas (12 Meses)
            </h3>
            <p className="text-xs text-default-400">
              Barra verde: Margen libre disponible • Barra roja: Compromiso en cuotas
            </p>
          </div>
        </CardHeader>

        <CardBody className="p-6 space-y-6">
          <div className="space-y-3.5">
            {projections.map((p, idx) => {
              const pctCompromiso =
                estimatedIncome > 0 ? (p.cuotasTotales / estimatedIncome) * 100 : 0;
              const pctLibre =
                estimatedIncome > 0 ? (p.margenDisponible / estimatedIncome) * 100 : 100;

              return (
                <div
                  key={p.mes}
                  className="p-3 rounded-xl bg-default-100/40 border border-default-200/60 hover:bg-default-100/80 transition-all space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground min-w-[70px]">{p.mes}</span>
                      {idx === 0 && (
                        <Chip size="sm" color="primary" variant="flat" className="h-5 text-[10px]">
                          Mes Actual
                        </Chip>
                      )}
                      {p.cuotasTotales === 0 && (
                        <Chip size="sm" color="success" variant="flat" className="h-5 text-[10px]">
                          100% Libre de Cuotas
                        </Chip>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <span className="text-rose-400/90">
                        Cuotas: {formatCurrency(p.cuotasTotales)} ({formatPercent(pctCompromiso)})
                      </span>
                      <span className="text-emerald-400 font-bold">
                        Libre: {formatCurrency(p.margenDisponible)} ({formatPercent(pctLibre)})
                      </span>
                    </div>
                  </div>

                  {/* Barra Dual: Carga vs Margen Libre */}
                  <div className="h-3 w-full bg-default-200 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${Math.min(100, pctCompromiso)}%` }}
                      className="bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-500"
                    />
                    <div
                      style={{ width: `${Math.max(0, 100 - pctCompromiso)}%` }}
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Hitos de Desendeudamiento y Liberación */}
      <Card className="border border-default-200/80 bg-background/70 backdrop-blur-xl shadow-lg">
        <CardHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2.5">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-foreground">
              Hitos de Extinción de Cuotas
            </h3>
          </div>
        </CardHeader>

        <CardBody className="p-6">
          {debtFreeMilestones.length === 0 ? (
            <div className="text-center py-6 text-xs text-default-400">
              No hay deudas activas pendientes de extinción.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {debtFreeMilestones.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-xl bg-default-100/70 border border-default-200 space-y-2"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-default-400 font-medium">Fin de pago</span>
                    <span className="text-emerald-400 font-bold capitalize">
                      {m.liberacionDate}
                    </span>
                  </div>
                  <div className="font-bold text-sm text-foreground">{m.descripcion}</div>
                  <div className="text-xs text-default-400 pt-1 border-t border-default-200 flex justify-between">
                    <span>Flujo liberado:</span>
                    <span className="font-bold text-emerald-400">
                      +{formatCurrency(m.cuotaLiberada)}/mes
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default LiquidityView;
