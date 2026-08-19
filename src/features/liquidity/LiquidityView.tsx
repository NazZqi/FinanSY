import React, { useMemo } from 'react';
import { Card, CardBody, CardHeader, Chip, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import {
  TrendingUp,
  Zap,
  HelpCircle,
  Sparkles,
  CalendarCheck2,
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
  const recoveredAmount = Math.max(0, finalMargin - (estimatedIncome - currentCommitment));

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

        <div className="bg-default-100/70 p-3.5 rounded-xl border border-default-200/80 min-w-[220px] text-right space-y-0.5">
          <span className="text-xs text-default-400 font-semibold uppercase tracking-wider block">
            Margen Proyectado (Mes 12)
          </span>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {formatCurrency(finalMargin)}
          </div>
          <span className="text-[11px] text-default-400 block font-mono">
            {recoveredAmount > 0
              ? `+${formatCurrency(recoveredAmount)}/mes recuperados`
              : 'Flujo 100% libre de cuotas'}
          </span>
        </div>
      </div>

      {/* Gráfico Visual de Curva de Alivio (Barras Proyectadas) */}
      <Card className="border border-default-200/80 bg-default-100/30 backdrop-blur-xl shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-sm">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-foreground">
                  Proyección de Margen vs. Carga en Cuotas (12 Meses)
                </h3>
                <Popover placement="bottom" showArrow backdrop="opaque">
                  <PopoverTrigger>
                    <button
                      type="button"
                      aria-label="Información de la Curva de Alivio"
                      className="text-default-400 hover:text-blue-400 transition-colors p-0.5 rounded focus:outline-none"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-4 max-w-xs bg-background/95 border border-default-200/80 shadow-xl rounded-xl">
                    <div className="space-y-2 text-xs">
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-400" /> Cómo leer este gráfico
                      </div>
                      <p className="text-default-300 text-[11px] leading-relaxed">
                        Cada fila representa un mes futuro. A medida que terminas de pagar cuotas,
                        la franja roja disminuye y la verde (dinero libre) aumenta hasta recuperar el 100% de tu sueldo estimado.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xs text-default-400">
                Evolución de tu poder de ahorro mes a mes
              </p>
            </div>
          </div>

          {/* Leyenda Visual con Puntos de Color */}
          <div className="flex items-center gap-3 text-xs font-semibold self-start sm:self-auto bg-default-100/60 px-3 py-1.5 rounded-xl border border-default-200/60">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-default-300 text-[11px]">Margen Libre</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0" />
              <span className="text-default-300 text-[11px]">Compromiso Cuotas</span>
            </div>
          </div>
        </CardHeader>

        <CardBody className="p-6 space-y-6">
          <div className="space-y-3">
            {projections.map((p, idx) => {
              const pctCompromiso =
                estimatedIncome > 0 ? (p.cuotasTotales / estimatedIncome) * 100 : 0;
              const pctLibre =
                estimatedIncome > 0 ? (p.margenDisponible / estimatedIncome) * 100 : 100;

              return (
                <div
                  key={p.mes}
                  className="p-3 rounded-xl bg-default-100/50 border border-default-200/60 hover:bg-default-100/80 transition-all space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground min-w-[70px] font-mono">{p.mes}</span>
                      {idx === 0 && (
                        <Chip size="sm" color="primary" variant="flat" className="h-5 text-[10px] font-bold">
                          Mes Actual
                        </Chip>
                      )}
                      {p.cuotasTotales === 0 && (
                        <Chip size="sm" color="success" variant="flat" className="h-5 text-[10px] font-bold">
                          100% Libre
                        </Chip>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-rose-400/90 text-[11px]">
                        Cuotas: {formatCurrency(p.cuotasTotales)} ({formatPercent(pctCompromiso)})
                      </span>
                      <span className="text-emerald-400 font-bold text-[11px]">
                        Libre: {formatCurrency(p.margenDisponible)} ({formatPercent(pctLibre)})
                      </span>
                    </div>
                  </div>

                  {/* Barra Dual: Carga vs Margen Libre */}
                  <div className="h-2.5 w-full bg-default-200/50 rounded-full overflow-hidden flex">
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

      {/* Hitos de Extinción de Cuotas */}
      <Card className="border border-default-200/80 bg-default-100/30 backdrop-blur-xl shadow-lg">
        <CardHeader className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-sm">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Hitos de Extinción de Cuotas
              </h3>
              <p className="text-xs text-default-400">
                Momentos clave donde finalizas el pago total de una compra y recuperas presupuesto
              </p>
            </div>
          </div>
          <span className="text-xs text-default-400 font-mono">
            {debtFreeMilestones.length} {debtFreeMilestones.length === 1 ? 'hito próximo' : 'hitos próximos'}
          </span>
        </CardHeader>

        <CardBody className="p-6">
          {debtFreeMilestones.length === 0 ? (
            <div className="text-center py-8 space-y-2 text-default-400">
              <CalendarCheck2 className="w-10 h-10 text-emerald-400/60 mx-auto" />
              <p className="font-medium text-sm text-foreground">¡Sin deudas pendientes!</p>
              <p className="text-xs">No tienes cuotas activas programadas para extinguirse.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {debtFreeMilestones.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-xl bg-default-100/60 border border-default-200/70 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-default-400 font-semibold uppercase tracking-wider text-[10px]">
                      Fin de pago
                    </span>
                    <Chip size="sm" color="warning" variant="flat" className="h-5 text-[10px] font-bold">
                      En {m.remainingMonths} {m.remainingMonths === 1 ? 'mes' : 'meses'}
                    </Chip>
                  </div>

                  <div>
                    <div className="font-bold text-sm text-foreground line-clamp-1">
                      {m.descripcion}
                    </div>
                    <div className="text-xs text-default-400 capitalize mt-0.5">
                      {m.liberacionDate}
                    </div>
                  </div>

                  <div className="text-xs text-default-400 pt-2 border-t border-default-200/60 flex justify-between items-center font-mono">
                    <span>Flujo recuperado:</span>
                    <span className="font-bold text-emerald-400 text-sm">
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
