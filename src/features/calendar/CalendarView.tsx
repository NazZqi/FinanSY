import React, { useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Progress,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@heroui/react';
import {
  Calendar as CalendarIcon,
  CreditCard,
  Trash2,
  CheckCircle,
  Clock,
  ShoppingBag,
  Plus,
  Minus,
  AlertCircle,
} from 'lucide-react';
import { useInstallments } from '../../context/InstallmentsContext';
import { formatCurrency, formatPercent } from '../../utils/amortization';
import { ActiveInstallmentPurchase } from '../../types/finance';

export const CalendarView: React.FC = () => {
  const {
    purchases,
    removePurchase,
    updateCuotasPagadas,
    estimatedIncome,
  } = useInstallments();

  // Modal para confirmar eliminación
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
  const [purchaseToDelete, setPurchaseToDelete] = useState<ActiveInstallmentPurchase | null>(null);

  // Cálculos consolidados del mes
  const activePurchases = purchases.filter((p) => p.cuotasPagadas < p.numeroCuotas);
  const totalCompromisoMes = activePurchases.reduce((acc, curr) => acc + curr.cuotaMensual, 0);
  const dtiMensual = estimatedIncome > 0 ? (totalCompromisoMes / estimatedIncome) * 100 : 0;
  const margenLibreRestante = Math.max(0, estimatedIncome - totalCompromisoMes);

  // Próximos vencimientos ordenados por día del mes
  const sortedUpcoming = [...activePurchases].sort((a, b) => a.diaPagoMensual - b.diaPagoMensual);

  const confirmDelete = (p: ActiveInstallmentPurchase) => {
    setPurchaseToDelete(p);
    onOpen();
  };

  const handleExecuteDelete = () => {
    if (purchaseToDelete) {
      removePurchase(purchaseToDelete.id);
      setPurchaseToDelete(null);
    }
    onClose();
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Resumen Superior del Mes (Icono + Título + Valor + Subtítulo) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Compromiso */}
        <Card className="border border-default-200/80 bg-default-100/30 backdrop-blur-xl shadow-lg">
          <CardBody className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-sm">
              <CreditCard className="w-6 h-6" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <span className="text-xs text-default-400 font-semibold block uppercase tracking-wider">
                Compromiso en Cuotas
              </span>
              <div className="text-2xl font-black text-foreground font-mono truncate">
                {formatCurrency(totalCompromisoMes)}
              </div>
              <span className="text-[11px] text-default-400 block">
                {activePurchases.length} {activePurchases.length === 1 ? 'cuota activa' : 'cuotas activas'} este mes
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Card 2: Carga en Ingreso */}
        <Card className="border border-default-200/80 bg-default-100/30 backdrop-blur-xl shadow-lg">
          <CardBody className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-sm">
              <Clock className="w-6 h-6" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <span className="text-xs text-default-400 font-semibold block uppercase tracking-wider">
                Carga en Ingreso
              </span>
              <div className="text-2xl font-black text-foreground font-mono truncate">
                {formatPercent(dtiMensual)}
              </div>
              <span className="text-[11px] text-default-400 block font-mono">
                De {formatCurrency(estimatedIncome)} estimados
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Card 3: Margen Libre */}
        <Card className="border border-default-200/80 bg-default-100/30 backdrop-blur-xl shadow-lg">
          <CardBody className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <span className="text-xs text-default-400 font-semibold block uppercase tracking-wider">
                Margen Libre Restante
              </span>
              <div className="text-2xl font-black text-emerald-400 font-mono truncate">
                {formatCurrency(margenLibreRestante)}
              </div>
              <span className="text-[11px] text-default-400 block">
                Liquidez para gastos corrientes
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Cronograma de Vencimientos con Chip de Ciclo Actual en esquina */}
      <Card className="border border-default-200/80 bg-default-100/30 backdrop-blur-xl shadow-lg relative overflow-hidden">
        <CardHeader className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-sm">
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
          <Chip
            size="sm"
            color="primary"
            variant="flat"
            className="font-bold border border-primary/30"
          >
            Ciclo Actual
          </Chip>
        </CardHeader>

        <CardBody className="p-6">
          {sortedUpcoming.length === 0 ? (
            <div className="text-center py-10 space-y-3 text-default-400">
              <CheckCircle className="w-12 h-12 text-emerald-400/50 mx-auto" />
              <p className="font-medium text-sm text-foreground">¡No tienes cuotas activas este ciclo!</p>
              <p className="text-xs max-w-sm mx-auto">
                Puedes simular una compra en la pestaña Simulador y guardarla para llevar su control aquí.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {sortedUpcoming.map((item) => {
                const cuotasRestantes = item.numeroCuotas - item.cuotasPagadas;
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-default-100/60 border border-default-200/70 hover:border-primary/50 transition-all flex flex-col justify-between space-y-3 group"
                  >
                    <div className="flex justify-between items-center">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/15 text-primary text-xs font-black font-mono">
                        Día {item.diaPagoMensual}
                      </div>
                      <span className="text-[11px] text-default-400 font-semibold px-2 py-0.5 rounded bg-default-200/40">
                        {item.tarjetaNombre || 'Tarjeta'}
                      </span>
                    </div>

                    <div>
                      <div className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {item.descripcion}
                      </div>
                      <div className="text-lg font-black text-foreground font-mono mt-0.5">
                        {formatCurrency(item.cuotaMensual)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-default-400 pt-2 border-t border-default-200/60 font-mono">
                      <span>Cuota {item.cuotasPagadas + 1}/{item.numeroCuotas}</span>
                      <span className="font-bold text-amber-400">
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

      {/* Gestión de Compras en Cuotas Activas */}
      <Card className="border border-default-200/80 bg-default-100/30 backdrop-blur-xl shadow-lg">
        <CardHeader className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Gestión de Compras en Cuotas Activas
              </h3>
              <p className="text-xs text-default-400">
                Registra los avances de pago de cada compromiso o elimina compromisos liquidados
              </p>
            </div>
          </div>
          <span className="text-xs text-default-400 font-mono">
            {purchases.length} {purchases.length === 1 ? 'registro' : 'registros'}
          </span>
        </CardHeader>

        <CardBody className="p-6">
          {purchases.length === 0 ? (
            <div className="text-center py-8 text-xs text-default-400">
              No hay compras en cuotas registradas en tu perfil.
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-1">
              {purchases.map((purchase) => {
                const porcentajeAvance = (purchase.cuotasPagadas / purchase.numeroCuotas) * 100;
                const estaSaldada = purchase.cuotasPagadas >= purchase.numeroCuotas;

                return (
                  <div
                    key={purchase.id}
                    className={`p-4 rounded-xl border transition-all ${
                      estaSaldada
                        ? 'bg-emerald-950/15 border-emerald-500/30 opacity-80'
                        : 'bg-default-100/60 border-default-200/70 hover:border-default-300'
                    } space-y-3`}
                  >
                    {/* Header de la tarjeta: Título + Datos de tarjeta a la izq, Avance % y Monto a la derecha */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-foreground">
                            {purchase.descripcion}
                          </h4>
                          {estaSaldada ? (
                            <Chip size="sm" color="success" variant="flat" className="font-bold text-[10px] h-5">
                              Saldada
                            </Chip>
                          ) : (
                            <Chip size="sm" variant="flat" color="primary" className="font-bold text-[10px] h-5 font-mono">
                              {purchase.cuotasPagadas}/{purchase.numeroCuotas}
                            </Chip>
                          )}
                        </div>
                        <p className="text-xs text-default-400">
                          {purchase.tarjetaNombre} • Día de corte: {purchase.diaPagoMensual} de cada mes
                        </p>
                      </div>

                      {/* Jerarquía: % Avance Destacado + Valor de Cuota */}
                      <div className="flex items-center sm:text-right justify-between sm:justify-end gap-3">
                        <div className="sm:text-right">
                          <span className="text-xl font-black text-foreground font-mono">
                            {formatPercent(porcentajeAvance)}
                          </span>
                          <span className="text-[11px] text-default-400 block font-mono">
                            {formatCurrency(purchase.cuotaMensual)} / mes
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Barra de Progreso */}
                    <div className="space-y-1">
                      <Progress
                        value={porcentajeAvance}
                        color={estaSaldada ? 'success' : 'primary'}
                        className="h-2 rounded-full"
                      />
                    </div>

                    {/* Controles de Pago y Eliminación: Agrupados a la derecha */}
                    <div className="flex items-center justify-between pt-1 border-t border-default-200/50">
                      <div className="text-[11px] text-default-400 font-mono">
                        {estaSaldada
                          ? 'Totalmente pagada'
                          : `${purchase.numeroCuotas - purchase.cuotasPagadas} cuotas restantes`}
                      </div>

                      {/* Botones de acción agrupados */}
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="flat"
                          color="default"
                          isDisabled={purchase.cuotasPagadas <= 0}
                          onPress={() => updateCuotasPagadas(purchase.id, -1)}
                          className="text-xs font-semibold h-7 px-2 border border-default-200/60"
                          startContent={<Minus className="w-3 h-3" />}
                        >
                          Cuota
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          isDisabled={estaSaldada}
                          onPress={() => updateCuotasPagadas(purchase.id, 1)}
                          className="text-xs font-bold h-7 px-2.5"
                          startContent={<Plus className="w-3 h-3" />}
                        >
                          +1 Pagada
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          color="danger"
                          isIconOnly
                          onPress={() => confirmDelete(purchase)}
                          className="h-7 w-7 text-default-400 hover:text-rose-400"
                          aria-label="Eliminar cuota"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modal de Confirmación de Eliminación */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
        <ModalContent>
          {(onCloseModal) => (
            <>
              <ModalHeader className="flex items-center gap-2 text-danger">
                <AlertCircle className="w-5 h-5" />
                <span>Confirmar Eliminación</span>
              </ModalHeader>
              <ModalBody className="text-sm text-default-300">
                ¿Estás seguro de que deseas eliminar la compra{' '}
                <strong>"{purchaseToDelete?.descripcion}"</strong>? Esta acción no se puede deshacer y se eliminará de las proyecciones de liquidez.
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" color="default" onPress={onCloseModal} className="font-semibold text-xs">
                  Cancelar
                </Button>
                <Button color="danger" onPress={handleExecuteDelete} className="font-bold text-xs">
                  Eliminar Compra
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default CalendarView;

