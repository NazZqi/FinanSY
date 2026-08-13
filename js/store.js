/**
 * FINANSY — STORE & STATE MANAGEMENT (CLEAN SLATE & LOCAL-FIRST)
 * Soporta valores numéricos reales (flotantes/enteros) y montos/porcentajes de ahorro exactos.
 */

const FinanStore = (() => {
  const STORAGE_KEY = 'finansy_data_v4';

  // Initial Clean State
  const defaultState = {
    hasCompletedOnboarding: false,
    monthlyIncome: 0,
    savingsBalance: 0,
    savingsTarget: 1000000,
    savingsRulePercent: 20, // 20% por defecto
    savingsRuleAmount: null, // Monto fijo mensual (ej: $10.000)
    fixedExpenses: [],
    goals: [],
    cards: [],
    installments: []
  };

  // Internal reactive listeners
  const listeners = [];

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...defaultState, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Error reading from localStorage, using clean defaults:', e);
    }
    return JSON.parse(JSON.stringify(defaultState));
  }

  let state = loadState();

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      notify();
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }

  function notify() {
    listeners.forEach(fn => fn(getState()));
  }

  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }

  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  // Currency Formatter para valores reales y flotantes
  function formatMoney(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0';
    const num = Number(amount);
    const isDecimal = num % 1 !== 0;
    
    if (isDecimal) {
      const parts = num.toFixed(2).split('.');
      const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      const decPart = parts[1].replace(/0+$/, '');
      return decPart ? `$${intPart},${decPart}` : `$${intPart}`;
    }

    return '$' + Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // Formatter para porcentajes (muestra decimales solo si los tiene, ej: 9.5% o 20%)
  function formatPercent(pct) {
    const num = Number(pct) || 0;
    return num % 1 !== 0 ? `${num.toFixed(1)}%` : `${num}%`;
  }

  // Operations
  function setOnboardingCompleted(completed = true) {
    state.hasCompletedOnboarding = !!completed;
    saveState();
  }

  function updateIncome(amount) {
    state.monthlyIncome = Math.max(0, Number(amount) || 0);
    // Si hay un monto fijo de ahorro, recalculamos el %
    if (state.savingsRuleAmount && state.monthlyIncome > 0) {
      state.savingsRulePercent = Number(((state.savingsRuleAmount / state.monthlyIncome) * 100).toFixed(2));
    }
    saveState();
  }

  function updateSavingsBalance(amount) {
    state.savingsBalance = Math.max(0, Number(amount) || 0);
    saveState();
  }

  function depositSavings(amount) {
    const num = Math.max(0, Number(amount) || 0);
    state.savingsBalance += num;
    saveState();
  }

  function withdrawSavings(amount) {
    const num = Math.max(0, Number(amount) || 0);
    state.savingsBalance = Math.max(0, state.savingsBalance - num);
    saveState();
  }

  function updateSavingsTarget(amount) {
    state.savingsTarget = Math.max(0, Number(amount) || 0);
    saveState();
  }

  function updateJarSettings({ balance, target, rulePercent, ruleAmount }) {
    if (balance !== undefined && balance !== '') state.savingsBalance = Math.max(0, Number(balance) || 0);
    if (target !== undefined && target !== '') state.savingsTarget = Math.max(0, Number(target) || 0);
    
    if (ruleAmount !== undefined && ruleAmount !== '' && Number(ruleAmount) > 0) {
      state.savingsRuleAmount = Number(ruleAmount);
      if (state.monthlyIncome > 0) {
        state.savingsRulePercent = Number(((Number(ruleAmount) / state.monthlyIncome) * 100).toFixed(2));
      }
    } else if (rulePercent !== undefined && rulePercent !== '') {
      state.savingsRulePercent = Math.max(0, Math.min(100, Number(rulePercent) || 0));
      if (state.monthlyIncome > 0) {
        state.savingsRuleAmount = Number((state.monthlyIncome * (state.savingsRulePercent / 100)).toFixed(2));
      }
    }
    saveState();
  }

  function addExpense(name, amount) {
    state.fixedExpenses.push({
      id: 'exp_' + Date.now(),
      name: name.trim() || 'Gasto General',
      amount: Number(amount) || 0
    });
    saveState();
  }

  function deleteExpense(id) {
    state.fixedExpenses = state.fixedExpenses.filter(e => e.id !== id);
    saveState();
  }

  function addGoal(goal) {
    state.goals.push({
      id: 'goal_' + Date.now(),
      name: goal.name.trim() || 'Nueva Meta',
      target: Number(goal.target) || 100000,
      current: Number(goal.current) || 0,
      emoji: goal.emoji || '🎯'
    });
    saveState();
  }

  function updateGoalAmount(id, delta) {
    const goal = state.goals.find(g => g.id === id);
    if (goal) {
      goal.current = Math.max(0, goal.current + delta);
      saveState();
    }
  }

  function deleteGoal(id) {
    state.goals = state.goals.filter(g => g.id !== id);
    saveState();
  }

  function addCard(card) {
    state.cards.push({
      id: 'card_' + Date.now(),
      alias: card.alias.trim() || 'Mi Tarjeta',
      type: card.type || 'credito',
      color: card.color || 'gradient-dark',
      limit: Number(card.limit) || 0,
      used: Number(card.used) || 0,
      interestRate: Number(card.interestRate) || 0,
      billingDay: Number(card.billingDay) || 15,
      paymentDueDay: Number(card.paymentDueDay) || 5,
      reminderDaysBefore: Number(card.reminderDaysBefore) || 3,
      lastPaidMonth: null
    });
    saveState();
  }

  function markCardAsPaid(cardId) {
    const card = state.cards.find(c => c.id === cardId);
    if (card) {
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      card.lastPaidMonth = currentMonthKey;
      card.used = 0;
      saveState();
    }
  }

  function unmarkCardAsPaid(cardId) {
    const card = state.cards.find(c => c.id === cardId);
    if (card) {
      card.lastPaidMonth = null;
      saveState();
    }
  }

  function deleteCard(id) {
    state.cards = state.cards.filter(c => c.id !== id);
    saveState();
  }

  function addInstallment(inst) {
    state.installments.push({
      id: 'inst_' + Date.now(),
      name: inst.name.trim() || 'Compra en Cuotas',
      monthlyAmount: Number(inst.monthlyAmount) || 0,
      remainingMonths: Number(inst.remainingMonths) || 1,
      cardId: inst.cardId || null
    });
    if (inst.cardId) {
      const card = state.cards.find(c => c.id === inst.cardId);
      if (card && inst.totalPurchase) {
        card.used = Math.min(card.limit, card.used + Number(inst.totalPurchase));
      }
    }
    saveState();
  }

  function deleteInstallment(id) {
    state.installments = state.installments.filter(i => i.id !== id);
    saveState();
  }

  function resetAllData() {
    state = JSON.parse(JSON.stringify(defaultState));
    saveState();
  }

  function loadSampleData(sample) {
    state = { ...state, ...sample };
    saveState();
  }

  return {
    getState,
    subscribe,
    formatMoney,
    formatPercent,
    setOnboardingCompleted,
    updateIncome,
    updateSavingsBalance,
    depositSavings,
    withdrawSavings,
    updateSavingsTarget,
    updateJarSettings,
    addExpense,
    deleteExpense,
    addGoal,
    updateGoalAmount,
    deleteGoal,
    addCard,
    deleteCard,
    markCardAsPaid,
    unmarkCardAsPaid,
    addInstallment,
    deleteInstallment,
    resetAllData,
    loadSampleData
  };
})();
