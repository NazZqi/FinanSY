# 💳 FinanSY — Simulador Inteligente de Compras en Cuotas & Gestor de Flujo Futuro

<div align="center">

![FinanSY Banner](https://img.shields.io/badge/FinanSY-Simulador_de_Cuotas-10B981?style=for-the-badge&logo=shield)
![Foco](https://img.shields.io/badge/Foco-Compras_a_Plazos_%26_Amortización-0284C7?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-100%25_Privado_%26_Offline-F59E0B?style=for-the-badge&logo=pwa)
![Tech](https://img.shields.io/badge/Vanilla-JS_ES6+_%26_CSS3-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/Licencia-MIT-green?style=for-the-badge)

**Evalúa el costo real de tus compras a plazo y proyecta el impacto en tu flujo de caja mensual antes de endeudarte.**  
100% privado, sin registros bancarios invasivos, ejecutado en tu navegador.

[🎯 Propuesta de Valor](#-propuesta-única-de-valor) • [🧮 Módulos del Sistema](#-jerarquía-y-módulos-del-sistema) • [🏗️ Arquitectura JS](#%EF%B8%8F-arquitectura-de-módulos-js) • [🚀 Uso Rápido](#-instalación-y-uso-rápido)

</div>

---

## 🎯 Propuesta Única de Valor (UVP)

El endeudamiento descontrolado en cuotas ocurre porque las personas toman decisiones de compra evaluando únicamente el saldo actual, sin dimensionar **cómo afectará esa nueva cuota a su liquidez durante los próximos 3, 6, 12 o 24 meses**.

**FinanSY resuelve este dolor de raíz:**
1. **Antes de comprar:** Simula el costo total (contado vs. cuotas con/sin interés) y entrega un **Semáforo de Impacto en tiempo real** que evalúa si la cuota compromete tu margen libre o fondo de reserva.
2. **Durante el plazo:** Centraliza el **seguimiento de cuotas activas**, proyectando el **calendario exacto de vencimientos** y cuándo se liberará tu capacidad financiera.

---

## 🧮 Jerarquía y Módulos del Sistema

```
                         ┌───────────────────────────────────────────────┐
                         │      FINANSY — FLUJO CORE DE DECISIÓN        │
                         └───────────────────────────────────────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────────┐
                   ▼                                                           ▼
       [ MÓDULO PRINCIPAL ]                                        [ GESTOR DE CRÉDITO ]
  🧮 Simulador & Semáforo de Impacto                          💳 Gestor de Cuotas & Tarjetas
  - Contado vs. Cuotas (1 a 36)                              - Cupo Total / Usado / Disponible
  - Tasas de interés y recargo total                         - Tracking de cuotas en curso (ej: 4/12)
  - Protección de margen intocable                           - Alertas de sobreendeudamiento
  - Veredicto visual: 🟢 🟡 🔴                               - Control de fechas de corte y pago
                   │                                                           │
                   └─────────────────────────────┬─────────────────────────────┘
                                                 ▼
                                     [ PROYECCIÓN DE FLUJO ]
                                📅 Calendario & Alivio de Liquidez
                                - Proyección mes a mes de cuotas por vencer
                                - Fecha estimada de liberación de presupuesto
                                - Carga de endeudamiento sobre ingresos netos
                                                 │
                                                 ▼
                                     [ MÓDULOS DE SOPORTE ]
                                🛡️ Margen Disponible & Fondo de Reserva
                                🎯 Metas de Ahorro / Liquidación de Saldos
                                🧾 Digitalizador Auxiliar de Comprobantes
```

---

### 1. 🧮 Módulo Principal — Simulador de Compra & Semáforo de Impacto
* **Pantalla Inicial & Núcleo Operativo:** Diseñado para utilizarse en el punto de decisión de compra (tienda física o e-commerce).
* **Dos Modos de Simulación Adaptables:**
  * ⚡ **Modo Rápido (Quick Check):** Evalúa la viabilidad en segundos ingresando únicamente tu ingreso estimado y el valor de la compra, sin requerir haber configurado tarjetas ni gastos previamente.
  * 🔗 **Modo Integrado (Perfil Completo):** Cruza la simulación contra tus gastos fijos, cuotas activas y cupos reales almacenados en `store.js`.
* **Motor de Amortización Francesa & Costos Operacionales:**
  $$\text{Cuota Base} = \begin{cases} \frac{M}{n} & \text{si } i = 0 \\ M \cdot \frac{i(1+i)^n}{(1+i)^n - 1} & \text{si } i > 0 \end{cases}$$
  $$\text{Cuota Real Mensual} = \text{Cuota Base} + \text{Comisión Mantención} + \frac{\text{Impuesto Timbres}}{n}$$
* **Umbrales Matemáticos Cuantitativos del Semáforo:**

| Modo | 🟢 Verde (Compra Segura) | 🟡 Amarillo (Precaución / Ajuste) | 🔴 Rojo (Alto Riesgo) |
| :--- | :--- | :--- | :--- |
| **⚡ Quick Check** | Cuota $\le 10\%$ del ingreso estimado | Cuota entre $10\%$ y $20\%$ del ingreso | Cuota $> 20\%$ del ingreso estimado |
| **🔗 Integrado** | $\text{DTI}_{\text{post}} \le 35\%$ y Consumo Margen $\le 50\%$ | $35\% < \text{DTI}_{\text{post}} \le 50\%$ o Consumo Margen $50\%-85\%$ | $\text{DTI}_{\text{post}} > 50\%$, Consumo $> 85\%$ o Cupo Excedido |

* **Acción en un Clic:** Botón para consolidar la simulación directamente como un compromiso activo en tu plan de pagos.

---

### 2. 💳 Módulo Secundario — Gestor de Cuotas y Tarjetas de Crédito
* **Control de Líneas de Crédito:** Monitoreo del cupo total, cupo utilizado por compras pendientes y cupo disponible real.
* **Seguimiento de Cuotas en Curso:** Visualiza compras vigentes con indicador de progreso (ejemplo: *Notebook Dell — Cuota 4 de 12 restantes*).
* **Fechas Clave:** Recordatorio preventivo de días de facturación/corte y días límite de pago para evitar intereses por mora.

---

### 3. 📅 Módulo de Proyección — Calendario y Flujo Futuro
* **Calendario de Pagos:** Proyección cronológica de las obligaciones del mes en curso y próximos periodos.
* **Curva de Alivio Financiero:** Muestra exactamente en qué mes finalizan tus cuotas vigentes y cuándo tu flujo de caja vuelve a expandirse.
* **Porcentaje de Compromiso:** Métrica en tiempo real del ratio `(Gastos Fijos + Cuotas) / Ingreso Neto`.

---

### 4. 🛡️ Módulos de Soporte (Margen, Metas y Asistencia)
* **Margen Disponible & Fondo de Reserva:** Monitoreo simplificado del colchón de liquidez para emergencias.
* **Metas de Ahorro:** Planificación de compras a mediano plazo para privilegiar el pago al contado sobre el crédito.
* **Digitalizador Auxiliar de Boletas (OCR):** Extracción rápida de montos desde fotos de comprobantes para simular o cargar gastos sin digitación manual.

---

## 🏗️ Arquitectura de Módulos `js/`

El código está estructurado bajo una arquitectura modular desacoplada en JavaScript Vanilla (ES6+), orientada a eventos y estado centralizado reactivo:

```plaintext
js/
├── store.js            # 🗄️ ESTADO CENTRAL & PERSISTENCIA LOCAL
│                       # Administra ingresos, tarjetas, compromisos en cuotas,
│                       # gastos fijos y suscripciones de cambio de estado.
│
├── calculator.js       # 🧮 MOTOR DE SIMULACIÓN (CORE)
│                       # Cálculo de amortización en cuotas, intereses,
│                       # evaluación de margen de seguridad y semáforo de impacto.
│
├── cards.js            # 💳 GESTIÓN DE TARJETAS Y CUOTAS ACTIVAS
│                       # Control de cupos (usado/disponible), ciclos de corte
│                       # y listado de compras en cuotas en curso.
│
├── dashboard.js        # 📊 PROYECCIÓN DE FLUJO Y CALENDARIO
│                       # Gráficos de compromiso, calendario mensual de pagos
│                       # y cálculo de la tasa de endeudamiento.
│
├── app.js              # 🎛️ ORQUESTADOR & NAVEGACIÓN
│                       # Enrutador de pestañas (priorizando Simulador),
│                       # gestión de modales, alertas y ciclo de vida de la app.
│
├── jarra.js            # 🛡️ MARGEN & FONDO DE RESERVA (SOPORTE)
│                       # Indicador visual del colchón de emergencia y reserva.
│
├── goals.js            # 🎯 PLANIFICACIÓN DE METAS (SOPORTE)
│                       # Gestión de objetivos de ahorro previo a compras.
│
└── receipt-scanner.js  # 🧾 DIGITALIZADOR OCR AUXILIAR
                        # Procesamiento y extracción de datos de comprobantes.
```

---

## 🔒 Privacidad Absoluta & Enfoque Local-First

* **Cero Telemetría:** No recopilamos credenciales bancarias ni información personal.
* **Almacenamiento en el Dispositivo:** Toda la información vive exclusivamente en el `localStorage` de tu navegador.
* **Offline-First (PWA):** Instálalo en tu smartphone o laptop; funciona 100% sin conexión a internet.

---

## 🚀 Instalación y Uso Rápido

No requiere Node.js para funcionar en producción, solo un navegador web.

```bash
# Opción A: Servidor local simple con Python
python -m http.server 8080

# Opción B: Con Node.js
npx serve .
```

Abre en tu navegador: `http://localhost:8080` (La aplicación se abrirá directamente en el **Simulador de Compra**).

---

## 📄 Licencia

Distribuido bajo la Licencia MIT.
