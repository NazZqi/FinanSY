import React, { useState, useMemo } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@heroui/react';
import {
  Calculator,
  Percent,
  Layers,
  Sparkles,
  Info,
  Calendar,
  CreditCard,
} from 'lucide-react';
import { PurchaseSimulationInput } from '../../types/finance';
import { calculateAmortization, formatCurrency } from '../../utils/amortization';
import { QuickCheckCard } from './QuickCheckCard';
import { AmortizationTable } from './AmortizationTable';
import { useInstallments } from '../../context/InstallmentsContext';

export const SimulatorView: React.FC = () => {
  const { estimatedIncome, setEstimatedIncome, addPurchase } = useInstallments();

  // Inputs de simulación
  const [montoTotal, setMontoTotal] = useState<number>(240000);
  const [numeroCuotas, setNumeroCuotas] = useState<number>(6);
  const [tasaInteresMensual, setTasaInteresMensual] = useState<number>(1.5);
  const [costosFijosMensuales, setCostosFijosMensuales] = useState<number>(0);
  const [isAmortizationOpen, setIsAmortizationOpen] = useState<boolean>(false);

  // Modal para guardar en cuotas activas
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
  const [purchaseDesc, setPurchaseDesc] = useState<string>('');
  const [purchaseCard, setPurchaseCard] = useState<string>('Tarjeta Principal');
  const [paymentDay, setPaymentDay] = useState<number>(5);

  const simulationInput: PurchaseSimulationInput = useMemo(
    () => ({
      montoTotal: Number(montoTotal) || 0,
      numeroCuotas: Math.max(1, Number(numeroCuotas) || 1),
      tasaInteresMensual: Number(tasaInteresMensual) || 0,
      costosFijosMensuales: Number(costosFijosMensuales) || 0,
      ingresoMensualEstimado: Number(estimatedIncome) || 0,
    }),
    [montoTotal, numeroCuotas, tasaInteresMensual, costosFijosMensuales, estimatedIncome]
  );

  const simulationResult = useMemo(
    () => calculateAmortization(simulationInput),
    [simulationInput]
  );

  const quickCuotas = [3, 6, 10, 12, 18, 24];

  const handleSavePurchase = () => {
    if (!purchaseDesc.trim()) return;

    addPurchase({
      descripcion: purchaseDesc.trim(),
      montoTotal: simulationInput.montoTotal,
      numeroCuotas: simulationInput.numeroCuotas,
      cuotasPagadas: 0,
      cuotaMensual: simulationResult.cuotaMensual,
      tasaInteresMensual: simulationInput.tasaInteresMensual,
      costosFijosMensuales: simulationInput.costosFijosMensuales || 0,
      diaPagoMensual: paymentDay,
      fechaInicio: new Date().toISOString().split('T')[0],
      tarjetaNombre: purchaseCard,
      categoria: 'Compra a Plazos',
    });

    onClose();
    setPurchaseDesc('');
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Banner de Bienvenida y Propósito */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-default-900/60 to-default-900/40 border border-emerald-500/20 backdrop-blur-xl shadow-lg">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Asistente de Decisión Preventiva
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground">
            Simulador de Compras a Plazos
          </h2>
          <p className="text-sm text-default-400 max-w-xl">
            Evalúa al instante el impacto en tu liquidez antes de comprometer una nueva cuota.
            Cálculo formal bajo sistema de amortización francés.
          </p>
        </div>

        {/* Configuración rápida de Ingreso Estimado */}
        <div className="bg-default-100/70 p-3.5 rounded-xl border border-default-200/80 min-w-[240px] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-default-400 font-medium">
            <span>Ingreso Mensual Estimado</span>
            <span className="text-emerald-400 font-semibold text-[11px]">Base Semáforo</span>
          </div>
          <div className="relative">
            <input
              type="number"
              value={estimatedIncome || ''}
              onChange={(e) => setEstimatedIncome(Number(e.target.value))}
              placeholder="Ej: 950000"
              className="w-full bg-background/80 border border-default-300 rounded-lg px-3 py-1.5 text-sm font-bold text-foreground font-mono focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <div className="text-[11px] text-default-400 font-mono">
            {formatCurrency(estimatedIncome)} disponibles/mes
          </div>
        </div>
      </div>

      {/* Grid Principal: Parámetros de Compra + Veredicto Semafórico */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Formulario de Entrada */}
        <div className="lg:col-span-6 flex flex-col">
          <Card className="border border-default-200/80 bg-default-100/30 backdrop-blur-xl shadow-lg h-full flex flex-col justify-between">
            <CardHeader className="flex items-center gap-3 px-6 pt-6 pb-2">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Parámetros de la Compra
                </h3>
                <p className="text-xs text-default-400">
                  Ingresa las condiciones ofrecidas por la tienda o emisor
                </p>
              </div>
            </CardHeader>

            <CardBody className="p-6 space-y-5">
              {/* Monto Total */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-default-300 flex items-center justify-between">
                  <span>Monto Total Financiado ($)</span>
                  <span className="text-emerald-400 font-mono text-xs font-bold">
                    {formatCurrency(montoTotal)}
                  </span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-default-400 font-bold text-sm">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1000"
                    value={montoTotal || ''}
                    onChange={(e) => setMontoTotal(Number(e.target.value))}
                    className="w-full bg-default-100/70 border border-default-200 rounded-xl pl-8 pr-4 py-2.5 text-sm font-bold font-mono text-foreground focus:outline-none focus:border-primary transition-colors"
                    placeholder="Ej: 240000"
                  />
                </div>
              </div>

              {/* Número de Cuotas con Botones Rápidos */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-default-300 flex items-center justify-between">
                  <span>Plazo en Cuotas</span>
                  <span className="text-primary font-bold text-xs font-mono">{numeroCuotas} meses</span>
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {quickCuotas.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setNumeroCuotas(q)}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        numeroCuotas === q
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-default-100/60 hover:bg-default-200/80 text-default-300 border-default-200'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={numeroCuotas || ''}
                  onChange={(e) => setNumeroCuotas(Number(e.target.value))}
                  className="w-full bg-default-100/70 border border-default-200 rounded-xl px-4 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary transition-colors"
                  placeholder="O ingresa un número personalizado de cuotas"
                />
              </div>

              {/* Tasa de Interés Mensual & Costos Fijos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-default-300 flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-amber-400" /> Tasa Mensual (%)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tasaInteresMensual ?? ''}
                      onChange={(e) => setTasaInteresMensual(Number(e.target.value))}
                      className="w-full bg-default-100/70 border border-default-200 rounded-xl px-3 py-2 text-sm font-bold font-mono text-foreground focus:outline-none focus:border-primary"
                      placeholder="0.0"
                    />
                    <span className="absolute right-3 text-default-400 text-xs font-semibold">
                      % / mes
                    </span>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setTasaInteresMensual(0)}
                      className={`text-[10px] px-2.5 py-0.5 rounded-md font-bold border transition-colors ${
                        tasaInteresMensual === 0
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-default-100/60 text-default-400 border-default-200 hover:bg-default-200/50'
                      }`}
                    >
                      0% (Contado)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTasaInteresMensual(1.49)}
                      className="text-[10px] px-2.5 py-0.5 rounded-md font-semibold bg-default-100/60 text-default-400 border border-default-200 hover:bg-default-200/50"
                    >
                      1.49%
                    </button>
                  </div>
                </div>

                {/* Costos Fijos Mensuales */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-default-300 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" /> Costos Fijos ($/mes)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-default-400 font-bold">$</span>
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={costosFijosMensuales ?? ''}
                      onChange={(e) => setCostosFijosMensuales(Number(e.target.value))}
                      className="w-full bg-default-100/70 border border-default-200 rounded-xl pl-7 pr-3 py-2 text-sm font-bold font-mono text-foreground focus:outline-none focus:border-primary"
                      placeholder="0"
                    />
                  </div>
                  <p className="text-[10px] text-default-400 leading-tight">
                    Seguros de desgravamen o comisiones
                  </p>
                </div>
              </div>

              {/* Fórmulas Explicativas Rápidas */}
              <div className="p-3 bg-default-100/50 rounded-xl border border-default-200/60 text-[11px] text-default-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Sistema Francés:</strong> Cuotas constantes; amortización de capital creciente e interés decreciente en el tiempo.
                </span>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Tarjeta de Decisión y Verificativo Semafórico */}
        <div className="lg:col-span-6 flex flex-col">
          <QuickCheckCard
            result={simulationResult}
            input={simulationInput}
            onViewAmortization={() => setIsAmortizationOpen(true)}
            onSaveToActive={onOpen}
          />
        </div>
      </div>

      {/* Modal de Tabla de Amortización Francesa */}
      <AmortizationTable
        isOpen={isAmortizationOpen}
        onClose={() => setIsAmortizationOpen(false)}
        rows={simulationResult.tablaAmortizacion}
        montoTotal={simulationInput.montoTotal}
      />

      {/* Modal para Guardar Compra en Cuotas Activas */}
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        backdrop="blur"
        classNames={{
          base: 'bg-background/95 border border-default-200/80 shadow-2xl rounded-2xl',
        }}
      >
        <ModalContent>
          {(onCloseModal) => (
            <>
              <ModalHeader className="flex items-center gap-3 border-b border-default-100 pb-3">
                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Guardar en Cuotas Activas
                  </h3>
                  <p className="text-xs text-default-400 font-normal">
                    Se reflejará en tu Calendario y en la Curva de Liquidez
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="space-y-4 py-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-default-300">
                    Descripción de la Compra
                  </label>
                  <input
                    type="text"
                    value={purchaseDesc}
                    onChange={(e) => setPurchaseDesc(e.target.value)}
                    placeholder="Ej: Refrigerador No Frost, Laptop Trabajo"
                    className="w-full bg-default-100 border border-default-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-default-300 flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-default-400" /> Tarjeta / Emisor
                    </label>
                    <input
                      type="text"
                      value={purchaseCard}
                      onChange={(e) => setPurchaseCard(e.target.value)}
                      placeholder="Ej: Visa Banco, CMR"
                      className="w-full bg-default-100 border border-default-200 rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-default-300 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-default-400" /> Día de Pago (1-31)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={paymentDay}
                      onChange={(e) => setPaymentDay(Math.min(31, Math.max(1, Number(e.target.value))))}
                      className="w-full bg-default-100 border border-default-200 rounded-xl px-3 py-2 text-xs font-semibold text-foreground font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-default-100/70 border border-default-200/60 rounded-xl space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-default-400 font-medium">Monto Financiado:</span>
                    <span className="font-bold text-foreground font-mono">{formatCurrency(simulationInput.montoTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-default-400 font-medium">Cuota Mensual:</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {formatCurrency(simulationResult.cuotaMensual)} x {simulationInput.numeroCuotas} meses
                    </span>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-default-100 pt-3">
                <Button variant="flat" color="default" onPress={onCloseModal} className="font-semibold text-xs">
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  onPress={handleSavePurchase}
                  isDisabled={!purchaseDesc.trim()}
                  className="font-bold text-xs shadow-md shadow-emerald-500/20"
                >
                  Confirmar y Guardar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default SimulatorView;

