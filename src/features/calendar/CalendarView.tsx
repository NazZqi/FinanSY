import React from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Progress,
} from '@heroui/react';
import {
  Calendar as CalendarIcon,
  CreditCard,
  Trash2,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useInstallments } from '../../context/InstallmentsContext';
import { formatCurrency, formatPercent } from '../../utils/amortization';

export const CalendarView: React.FC = () => {
  const {
    purchases,
    removePurchase,
    updateCuotasPagadas,
    estimatedIncome,
  } = useInstallments();

  // Cálculos consolidados del mes
  const activePurchases = purchases.filter((p) => p.cuotasPagadas < p.numeroCuotas);
  const totalCompromisoMes = activePurchases.reduce((acc, curr) => acc + curr.cuotaMensual, 0);
  const dtiMensual = estimatedIncome > 0 ? (totalCompromisoMes / estimatedIncome) * 100 : 0;

  // Próximos vencimientos ordenados por día del mes
  const sortedUpcoming = [...activePurchases].sort((a, b) => a.diaPagoMensual - b.diaPagoMensual);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Resumen Superior del Mes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-default-200/80 bg-background/60 backdrop-blur-xl shadow-lg">
          <CardBody className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-default-400 font-medium">Compromiso en Cuotas (Mes)</span>
              <div className="text-2xl font-black text-foreground">
                {formatCurrency(totalCompromisoMes)}
              </div>
              <span className="text-[11px] text-default-400">
                {activePurchases.length} cuotas activas este ciclo
              </span>
            </div>
          </CardBody>
        </Card>

        <Card className="border border-default-200/80 bg-background/60 backdrop-blur-xl shadow-lg">
          <CardBody className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-default-400 font-medium">Carga en Ingreso Mensual</span>
              <div className="text-2xl font-black text-foreground">
                {formatPercent(dtiMensual)}
              </div>
              <span className="text-[11px] text-default-400">
                De {formatCurrency(estimatedIncome)} estimados
              </span>
            </div>
          </CardBody>
        </Card>

        <Card className="border border-default-200/80 bg-background/60 backdrop-blur-xl shadow-lg">
          <CardBody className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-default-400 font-medium">Margen Libre Restante</span>
              <div className="text-2xl font-black text-emerald-400">
                {formatCurrency(Math.max(0, estimatedIncome - totalCompromisoMes))}
              </div>
              <span className="text-[11px] text-default-400">
                Liquidez para gastos corrientes
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Cronograma de Pagos del Mes (Días de Vencimiento) */}
      <Card className="border border-default-200/80 bg-background/70 backdrop-blur-xl shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Cronograma de Vencimientos
              </h3>
              <p className="text-xs text-default-400">
                Fechas de cobro y facturación ordenadas cronológicamente
              </p>
            </div>
          </div>
          <Chip size="sm" variant="flat" color="primary" className="font-semibold mt-2 sm:mt-0">
            Ciclo Actual
          </Chip>
        </CardHeader>

        <CardBody className="p-6">
          {sortedUpcoming.length === 0 ? (
            <div className="text-center py-10 space-y-3 text-default-400">
              <CheckCircle className="w-12 h-12 text-emerald-400/50 mx-auto" />
              <p className="font-medium text-sm">¡No tienes cuotas activas registradas!</p>
              <p className="text-xs max-w-sm mx-auto">
                Puedes simular una compra en la pestaña Simulador y guardarla para llevar su control aquí.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {sortedUpcoming.map((item) => {
                const cuotasRestantes = item.numeroCuotas - item.cuotasPagadas;
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-default-100/70 border border-default-200 hover:border-primary/40 transition-colors space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary text-xs font-black">
                        Día {item.diaPagoMensual}
                      </div>
                      <span className="text-[11px] text-default-400 font-medium">
                        {item.tarjetaNombre || 'Tarjeta'}
                      </span>
                    </div>

                    <div>
                      <div className="font-bold text-sm text-foreground line-clamp-1">
                        {item.descripcion}
                      </div>
                      <div className="text-lg font-black text-foreground mt-0.5">
                        {formatCurrency(item.cuotaMensual)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-default-400 pt-1 border-t border-default-200">
                      <span>Cuota {item.cuotasPagadas + 1} de {item.numeroCuotas}</span>
                      <span className="font-semibold text-amber-400">
                        {cuotasRestantes} {cuotasRestantes === 1 ? 'restante' : 'restantes'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Lista y Gestión Detallada de Cuotas Activas */}
      <Card className="border border-default-200/80 bg-background/70 backdrop-blur-xl shadow-lg">
        <CardHeader className="flex items-center justify-between px-6 pt-6 pb-2">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Gestión de Compras en Cuotas Activas
            </h3>
            <p className="text-xs text-default-400">
              Registra los avances de pago de cada compromiso o da de baja compras saldadas
            </p>
          </div>
        </CardHeader>

        <CardBody className="p-6 space-y-4">
          {purchases.length === 0 ? (
            <div className="text-center py-6 text-xs text-default-400">
              No hay compras en cuotas registradas en tu perfil.
            </div>
          ) : (
            <div className="space-y-3">
              {purchases.map((purchase) => {
                const porcentajeAvance = (purchase.cuotasPagadas / purchase.numeroCuotas) * 100;
                const estaSaldada = purchase.cuotasPagadas >= purchase.numeroCuotas;

                return (
                  <div
                    key={purchase.id}
                    className={`p-4 rounded-xl border transition-all ${
                      estaSaldada
                        ? 'bg-emerald-950/10 border-emerald-500/20 opacity-75'
                        : 'bg-default-100/60 border-default-200'
                    } space-y-3`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-foreground">
                            {purchase.descripcion}
                          </h4>
                          {estaSaldada && (
                            <Chip size="sm" color="success" variant="flat">
                              Saldada
                            </Chip>
                          )}
                        </div>
                        <p className="text-xs text-default-400">
                          {purchase.tarjetaNombre} • Día de corte: {purchase.diaPagoMensual} de cada mes
                        </p>
                      </div>

                      <div className="text-right flex items-center sm:flex-col justify-between sm:justify-start gap-1">
                        <span className="text-xs text-default-400">Cuota:</span>
                        <span className="text-base font-extrabold text-foreground">
                          {formatCurrency(purchase.cuotaMensual)}
                        </span>
                      </div>
                    </div>

                    {/* Barra de Progreso de Amortización */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-default-400">
                          Progreso: {purchase.cuotasPagadas} de {purchase.numeroCuotas} cuotas pagadas
                        </span>
                        <span className="text-foreground font-bold">
                          {formatPercent(porcentajeAvance)}
                        </span>
                      </div>
                      <Progress
                        value={porcentajeAvance}
                        color={estaSaldada ? 'success' : 'primary'}
                        className="h-2"
                      />
                    </div>

                    {/* Controles de Pago */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="flat"
                          color="default"
                          isDisabled={purchase.cuotasPagadas <= 0}
                          onPress={() => updateCuotasPagadas(purchase.id, -1)}
                          className="text-xs font-semibold h-7 px-2.5"
                        >
                          -1 Cuota
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          isDisabled={estaSaldada}
                          onPress={() => updateCuotasPagadas(purchase.id, 1)}
                          className="text-xs font-semibold h-7 px-2.5"
                        >
                          +1 Cuota Pagada
                        </Button>
                      </div>

                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        isIconOnly
                        onPress={() => removePurchase(purchase.id)}
                        className="h-7 w-7"
                        aria-label="Eliminar cuota"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default CalendarView;
