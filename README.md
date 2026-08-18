# 💳 FinanSY — Asistente Preventivo de Compras a Plazos

<div align="center">

![FinanSY Banner](https://img.shields.io/badge/FinanSY-Simulador_de_Cuotas-10B981?style=for-the-badge&logo=shield)
![Foco](https://img.shields.io/badge/Foco-Amortización_Francesa_%26_Semáforo-0284C7?style=for-the-badge)
![Tech](https://img.shields.io/badge/React_18-TypeScript_5-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![UI](https://img.shields.io/badge/HeroUI-Tailwind_CSS-8B5CF6?style=for-the-badge)
![License](https://img.shields.io/badge/Licencia-MIT-green?style=for-the-badge)

**Herramienta preventiva de apoyo a la toma de decisiones financieras antes de realizar compras a plazos.**  
Evalúa el impacto en el flujo de caja, calcula el Costo Total Financiero bajo amortización formal y proyecta la recuperación paulatina de liquidez.

[🎯 Propuesta de Valor](#-propuesta-de-valor) • [🧮 Fórmulas Financieras](#-reglas-financieras-y-fórmulas) • [🏗️ Arquitectura](#%EF%B8%8F-arquitectura-del-proyecto) • [🚀 Ejecución Local](#-ejecución-local)

</div>

---

## 🎯 Propuesta de Valor y Alcance

El sistema es una herramienta preventiva de apoyo a la toma de decisiones financieras antes de realizar compras a plazos.
- **Antes de comprar (Modo Quick Check):** Simula el costo total financiero, amortización e interés, y emite un veredicto semafórico instantáneo sin exigencia de registros previos.
- **Durante el plazo (Calendario & Cuotas):** Seguimiento de compras activas y vencimientos por fecha de corte.
- **Proyección futura (Curva de Alivio):** Gráfico de recuperación de liquidez libre a 12 meses conforme expiran los compromisos.

---

## 🧮 Reglas Financieras y Fórmulas

### 1. Amortización de Cuota Fija (Sistema Francés)

$$\text{Cuota Base} = \begin{cases} \frac{M}{n} & \text{si } i = 0 \\ M \cdot \frac{i(1+i)^n}{(1+i)^n - 1} & \text{si } i > 0 \end{cases}$$

Donde:
* $M$: Monto total financiado.
* $i$: Tasa de interés periódica mensual decimal ($\text{Tasa Mensual } / 100$).
* $n$: Número total de cuotas.

### 2. Cuota Final y Costos Totales

$$\text{Cuota Final Mensual} = \text{Cuota Base} + \text{Costos Fijos Mensuales}$$
$$\text{Costo Total Financiero} = \text{Cuota Final Mensual} \cdot n$$
$$\text{Sobrecosto Total} = \text{Costo Total Financiero} - M$$

### 3. Criterios del Semáforo de Viabilidad

$$\text{Impacto (\%)} = \left( \frac{\text{Cuota Final Mensual}}{\text{Ingreso Mensual Estimado}} \right) \cdot 100$$

* 🟢 **Verde (`green`):** $\text{Impacto} \le 15\%$ (Bajo riesgo / Compra viable).
* 🟡 **Amarillo (`yellow`):** $15\% < \text{Impacto} \le 30\%$ (Precaución / Carga media).
* 🔴 **Rojo (`red`):** $\text{Impacto} > 30\%$ (Alto riesgo de sobreendeudamiento).

---

## 🏗️ Arquitectura del Proyecto

```text
src/
├── components/
│   └── NavigationTabs.tsx          # Contenedor modular con carga diferida (React.lazy + Suspense)
├── features/
│   ├── simulator/                  # Tab 1: Núcleo preventivo y semáforo de viabilidad
│   │   ├── SimulatorView.tsx
│   │   ├── QuickCheckCard.tsx
│   │   └── AmortizationTable.tsx
│   ├── calendar/                   # Tab 2: Calendario y cuotas activas
│   │   └── CalendarView.tsx
│   └── liquidity/                  # Tab 3: Curva de alivio financiero y margen disponible
│       └── LiquidityView.tsx
├── types/
│   └── finance.ts                  # Modelado estricto de tipos de dominio
├── utils/
│   └── amortization.ts             # Motor de cálculo financiero
├── context/
│   └── InstallmentsContext.tsx     # Estado global persistente
├── App.tsx                         # Entry point con HeroUIProvider
└── main.tsx
```

---

## 🚀 Ejecución Local

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev

# 3. Compilar para producción
npm run build
```
