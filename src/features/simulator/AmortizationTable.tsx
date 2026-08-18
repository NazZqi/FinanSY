import React from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Card,
  CardBody,
  CardHeader,
} from '@heroui/react';
import { AmortizationRow } from '../../types/finance';
import { formatCurrency } from '../../utils/amortization';

interface AmortizationTableProps {
  rows: AmortizationRow[];
}

export const AmortizationTable: React.FC<AmortizationTableProps> = ({ rows }) => {
  return (
    <Card className="border border-default-200/60 bg-background/60 backdrop-blur-md shadow-md">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 pt-5 pb-3">
        <div>
          <h4 className="text-base font-bold text-foreground">Tabla de Amortización Francesa</h4>
          <p className="text-xs text-default-400">
            Evolución periódica del saldo deudor, amortización de capital e intereses
          </p>
        </div>
      </CardHeader>
      <CardBody className="px-3 sm:px-6 pb-6 pt-0">
        <div className="overflow-x-auto">
          <Table
            aria-label="Tabla de amortización detallada"
            isStriped
            removeWrapper
            className="min-w-full text-sm"
          >
            <TableHeader>
              <TableColumn className="font-semibold text-xs uppercase">Cuota #</TableColumn>
              <TableColumn className="font-semibold text-xs uppercase">Monto Cuota</TableColumn>
              <TableColumn className="font-semibold text-xs uppercase">Interés ($)</TableColumn>
              <TableColumn className="font-semibold text-xs uppercase">Amortización ($)</TableColumn>
              <TableColumn className="font-semibold text-xs uppercase">Saldo Restante</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No hay datos de simulación">
              {rows.map((row) => (
                <TableRow key={row.numeroCuota}>
                  <TableCell className="font-mono font-medium">#{row.numeroCuota}</TableCell>
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
      </CardBody>
    </Card>
  );
};
