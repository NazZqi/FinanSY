import React, { createContext, useContext, useState, useEffect } from 'react';
import { ActiveInstallmentPurchase } from '../types/finance';

interface InstallmentsContextType {
  purchases: ActiveInstallmentPurchase[];
  addPurchase: (purchase: Omit<ActiveInstallmentPurchase, 'id'>) => void;
  removePurchase: (id: string) => void;
  updateCuotasPagadas: (id: string, delta: number) => void;
  estimatedIncome: number;
  setEstimatedIncome: (income: number) => void;
}

const STORAGE_KEY_PURCHASES = 'finansy_active_purchases_v2';
const STORAGE_KEY_INCOME = 'finansy_estimated_income_v2';

const defaultPurchases: ActiveInstallmentPurchase[] = [
  {
    id: 'demo-1',
    descripcion: 'Smartphone 5G',
    montoTotal: 360000,
    numeroCuotas: 12,
    cuotasPagadas: 4,
    cuotaMensual: 33500,
    tasaInteresMensual: 1.8,
    costosFijosMensuales: 1500,
    diaPagoMensual: 5,
    fechaInicio: '2026-04-05',
    categoria: 'Tecnología',
    tarjetaNombre: 'Visa Gold',
  },
  {
    id: 'demo-2',
    descripcion: 'Pasajes Vacaciones',
    montoTotal: 180000,
    numeroCuotas: 6,
    cuotasPagadas: 2,
    cuotaMensual: 30000,
    tasaInteresMensual: 0,
    costosFijosMensuales: 0,
    diaPagoMensual: 15,
    fechaInicio: '2026-06-15',
    categoria: 'Viajes',
    tarjetaNombre: 'Mastercard Black',
  },
];

const InstallmentsContext = createContext<InstallmentsContextType | undefined>(undefined);

export const InstallmentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [purchases, setPurchases] = useState<ActiveInstallmentPurchase[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PURCHASES);
      return saved ? JSON.parse(saved) : defaultPurchases;
    } catch {
      return defaultPurchases;
    }
  });

  const [estimatedIncome, setEstimatedIncomeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INCOME);
      return saved ? Number(saved) : 950000;
    } catch {
      return 950000;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PURCHASES, JSON.stringify(purchases));
  }, [purchases]);

  const setEstimatedIncome = (income: number) => {
    setEstimatedIncomeState(income);
    localStorage.setItem(STORAGE_KEY_INCOME, String(income));
  };

  const addPurchase = (purchase: Omit<ActiveInstallmentPurchase, 'id'>) => {
    const newPurchase: ActiveInstallmentPurchase = {
      ...purchase,
      id: 'purch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    };
    setPurchases((prev) => [newPurchase, ...prev]);
  };

  const removePurchase = (id: string) => {
    setPurchases((prev) => prev.filter((p) => p.id !== id));
  };

  const updateCuotasPagadas = (id: string, delta: number) => {
    setPurchases((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const next = Math.max(0, Math.min(p.numeroCuotas, p.cuotasPagadas + delta));
          return { ...p, cuotasPagadas: next };
        }
        return p;
      })
    );
  };

  return (
    <InstallmentsContext.Provider
      value={{
        purchases,
        addPurchase,
        removePurchase,
        updateCuotasPagadas,
        estimatedIncome,
        setEstimatedIncome,
      }}
    >
      {children}
    </InstallmentsContext.Provider>
  );
};

export const useInstallments = () => {
  const context = useContext(InstallmentsContext);
  if (!context) {
    throw new Error('useInstallments must be used within an InstallmentsProvider');
  }
  return context;
};
