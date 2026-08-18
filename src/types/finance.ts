export type DecisionStatus = 'green' | 'yellow' | 'red';

export interface PurchaseSimulationInput {
  montoTotal: number;
  numeroCuotas: number;
  tasaInteresMensual: number; // Porcentaje nominal mensual (ej: 1.5)
  costosFijosMensuales?: number; // Seguros, comisiones de mantención
  ingresoMensualEstimado?: number; // Permite evaluación en Modo Rápido
}

export interface AmortizationRow {
  numeroCuota: number;
  montoCuota: number;
  interes: number;
  amortizacion: number;
  saldoRestante: number;
}

export interface SimulationResult {
  cuotaBase: number;
  cuotaMensual: number;
  costoTotalFinanciero: number;
  sobrecostoTotal: number;
  impactoIngresoPorcentaje: number;
  estadoSemaforo: DecisionStatus;
  tablaAmortizacion: AmortizationRow[];
}

export interface ActiveInstallmentPurchase {
  id: string;
  descripcion: string;
  montoTotal: number;
  numeroCuotas: number;
  cuotasPagadas: number;
  cuotaMensual: number;
  tasaInteresMensual: number;
  costosFijosMensuales: number;
  diaPagoMensual: number;
  fechaInicio: string; // YYYY-MM-DD
  categoria?: string;
  tarjetaNombre?: string;
}

export interface MonthlyLiquidityProjection {
  mes: string; // 'MMM YYYY'
  cuotasTotales: number;
  margenDisponible: number;
  ingresoEstimado: number;
  cuotasActivasCount: number;
}
