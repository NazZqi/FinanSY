/**
 * FINANSY — INTERACTIVE DEMONSTRATION MODULE
 * Carga un set completo de datos de demostración si la app está en limpio y ejecuta la simulación de compra.
 */

const FinanDemo = (() => {

  function loadDemoSimulation() {
    const globalState = FinanStore.getState();

    // Si la app está en blanco (ingreso 0 o sin tarjetas), cargamos un set demostrativo
    if (globalState.monthlyIncome === 0 || globalState.cards.length === 0) {
      FinanStore.loadSampleData({
        monthlyIncome: 1200000,
        savingsBalance: 450000,
        savingsTarget: 1500000,
        fixedExpenses: [
          { id: 'exp_1', name: 'Arriendo / Gastos Comunes', amount: 420000 },
          { id: 'exp_2', name: 'Servicios Básicos (Luz, Agua, Gas)', amount: 65000 },
          { id: 'exp_3', name: 'Supermercado & Alimentación', amount: 220000 },
          { id: 'exp_4', name: 'Internet & Telefonía Móvil', amount: 35000 }
        ],
        goals: [
          { id: 'goal_1', name: 'Fondo de Emergencia (3 meses)', target: 1500000, current: 450000, emoji: '🛡️' },
          { id: 'goal_2', name: 'Vacaciones de Verano', target: 800000, current: 200000, emoji: '✈️' }
        ],
        cards: [
          {
            id: 'card_1',
            alias: 'Santander Black Titanium',
            type: 'credito',
            color: 'gradient-dark',
            limit: 2500000,
            used: 650000,
            interestRate: 1.85,
            billingDay: 18,
            paymentDueDay: 5,
            reminderDaysBefore: 3,
            lastPaidMonth: null
          },
          {
            id: 'card_2',
            alias: 'CMR Falabella Pro',
            type: 'credito',
            color: 'gradient-emerald',
            limit: 1200000,
            used: 280000,
            interestRate: 2.10,
            billingDay: 10,
            paymentDueDay: 25,
            reminderDaysBefore: 3,
            lastPaidMonth: null
          }
        ],
        installments: [
          { id: 'inst_1', name: 'Smartphone Cuotas', monthlyAmount: 45000, remainingMonths: 4, cardId: 'card_1' }
        ]
      });
    }

    const updatedState = FinanStore.getState();
    const targetCard = updatedState.cards.find(c => c.type === 'credito') || updatedState.cards[0];

    // Configurar la simulación
    const demoData = {
      productName: 'MacBook Air M3 15" 512GB',
      productPrice: 1199990,
      selectedCardId: targetCard.id,
      hasInterest: false,
      monthlyRate: 1.85,
      installments: 6,
      savingsGuardPercent: 20
    };

    // Cambiar a la pestaña de Calculadora
    FinanApp.switchTab('calculadora');

    // Aplicar valores
    FinanCalculator.setValues(demoData);

    const cardTypeName = targetCard.type === 'credito' ? 'Crédito' : (targetCard.type === 'debito' ? 'Débito' : 'Prepago');
    FinanApp.showToast(
      `⚡ Demostración activada: "${demoData.productName}" · ${FinanStore.formatMoney(demoData.productPrice)} · ${targetCard.alias} (${cardTypeName})`,
      'info'
    );
  }

  return {
    loadDemoSimulation
  };
})();
