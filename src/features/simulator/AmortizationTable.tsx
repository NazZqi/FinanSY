import React from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from '@heroui/react';
import { TableProperties } from 'lucide-react';
import { AmortizationRow } from '../../types/finance';
import { formatCurrency } from '../../utils/amortization';

interface AmortizationTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  rows: AmortizationRow[];
  montoTotal: number;
}

export const AmortizationTable: React.FC<AmortizationTableModalProps> = ({
  isOpen,
  onClose,
  rows,
  montoTotal,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      backdrop="blur"
      scrollBehavior="inside"
      classNames={{
        base: 'bg-background/95 border border-default-200/80 shadow-2xl rounded-2xl max-h-[85vh]',
        header: 'border-b border-default-100 pb-3',
        footer: 'border-t border-default-100 pt-3',
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <TableProperties className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Tabla de Amortización Francesa
                </h3>
                <p className="text-xs text-default-400 font-normal">
                  Evolución periódica del saldo deudor para un capital inicial de {formatCurrency(montoTotal)}
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="p-4 sm:p-6">
              <div className="overflow-x-auto">
                <Table
                  aria-label="Tabla de amortización detallada"
                  isStriped
                  removeWrapper
                  className="min-w-full text-xs sm:text-sm"
                >
                  <TableHeader>
                    <TableColumn className="font-bold text-[11px] uppercase tracking-wider">Cuota #</TableColumn>
                    <TableColumn className="font-bold text-[11px] uppercase tracking-wider">Monto Cuota</TableColumn>
                    <TableColumn className="font-bold text-[11px] uppercase tracking-wider">Interés ($)</TableColumn>
                    <TableColumn className="font-bold text-[11px] uppercase tracking-wider">Amortización ($)</TableColumn>
                    <TableColumn className="font-bold text-[11px] uppercase tracking-wider">Saldo Restante</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No hay datos de simulación disponibles.">
                    {rows.map((row) => (
                      <TableRow key={row.numeroCuota}>
                        <TableCell className="font-mono font-bold text-foreground">
                          #{row.numeroCuota}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {formatCurrency(row.montoCuota)}
                        </TableCell>
                        <TableCell className="text-amber-400/90 font-mono text-xs">
                          {formatCurrency(row.interes)}
                        </TableCell>
                        <TableCell className="text-emerald-400/90 font-mono text-xs">
                          {formatCurrency(row.amortizacion)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-default-400">
                          {formatCurrency(row.saldoRestante)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ModalBody>

            <ModalFooter>
              <Button color="primary" variant="flat" onPress={onClose} className="font-semibold">
                Cerrar Tabla
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default AmortizationTable;
