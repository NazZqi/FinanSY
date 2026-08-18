import {
  PurchaseSimulationInput,
  SimulationResult,
  AmortizationRow,
  DecisionStatus,
} from '../types/finance';

/**
 * Calcula la simulación de una compra a plazos bajo el sistema de amortización francés.
 */
export function calculateAmortization(input: PurchaseSimulationInput): SimulationResult {
  const {
    montoTotal,
    numeroCuotas,
    tasaInteresMensual,
    costosFijosMensuales = 0,
    ingresoMensualEstimado = 0,
  } = input;

  if (montoTotal <= 0 || numeroCuotas <= 0) {
    return {
      cuotaBase: 0,
      cuotaMensual: 0,
      costoTotalFinanciero: 0,
      sobrecostoTotal: 0,
      impactoIngresoPorcentaje: 0,
      estadoSemaforo: 'green',
      tablaAmortizacion: [],
    };
  }

  const i = tasaInteresMensual / 100;
  const n = Math.round(numeroCuotas);

  // 1. Amortización de Cuota Fija (Sistema Francés)
  let cuotaBase = 0;
  if (i === 0) {
    cuotaBase = montoTotal / n;
  } else {
    const factor = Math.pow(1 + i, n);
    cuotaBase = montoTotal * ((i * factor) / (factor - 1));
  }

  // 2. Cuota Final Mensual y Costos Totales
  const cuotaMensual = cuotaBase + costosFijosMensuales;
  const costoTotalFinanciero = cuotaMensual * n;
  const sobrecostoTotal = Math.max(0, costoTotalFinanciero - montoTotal);

  // 3. Semáforo de Viabilidad
  let impactoIngresoPorcentaje = 0;
  let estadoSemaforo: DecisionStatus = 'green';

  if (ingresoMensualEstimado > 0) {
    impactoIngresoPorcentaje = (cuotaMensual / ingresoMensualEstimado) * 100;
    if (impactoIngresoPorcentaje <= 15) {
      estadoSemaforo = 'green';
    } else if (impactoIngresoPorcentaje <= 30) {
      estadoSemaforo = 'yellow';
    } else {
      estadoSemaforo = 'red';
    }
  }

  // 4. Generación de la Tabla de Amortización
  const tablaAmortizacion: AmortizationRow[] = [];
  let saldoRestante = montoTotal;

  for (let cuota = 1; cuota <= n; cuota++) {
    const interes = i > 0 ? saldoRestante * i : 0;
    let amortizacion = cuotaBase - interes;

    // Ajuste de precisión en la última cuota
    if (cuota === n || amortizacion > saldoRestante) {
      amortizacion = saldoRestante;
    }

    saldoRestante = Math.max(0, saldoRestante - amortizacion);

    tablaAmortizacion.push({
      numeroCuota: cuota,
      montoCuota: Math.round((cuotaBase + costosFijosMensuales) * 100) / 100,
      interes: Math.round(interes * 100) / 100,
      amortizacion: Math.round(amortizacion * 100) / 100,
      saldoRestante: Math.round(saldoRestante * 100) / 100,
    });
  }

  return {
    cuotaBase: Math.round(cuotaBase * 100) / 100,
    cuotaMensual: Math.round(cuotaMensual * 100) / 100,
    costoTotalFinanciero: Math.round(costoTotalFinanciero * 100) / 100,
    sobrecostoTotal: Math.round(sobrecostoTotal * 100) / 100,
    impactoIngresoPorcentaje: Math.round(impactoIngresoPorcentaje * 10) / 10,
    estadoSemaforo,
    tablaAmortizacion,
  };
}

/**
 * Formatea valores numéricos como moneda local
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/**
 * Formatea porcentajes con 1 o 2 decimales
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
