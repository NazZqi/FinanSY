/**
 * FINANSY — STORE & STATE MANAGEMENT (CLEAN SLATE & LOCAL-FIRST)
 * Soporta esquemas dinámicos: Libertad Financiera, Común y Personalizado,
 * jarras múltiples customizables, valores numéricos reales y cálculo de métricas financieras.
 */

const FinanStore = (() => {
  const STORAGE_KEY = 'finansy_data_v6';

  const defaultJarsConfig = {
    libertad_financiera: [
      {
        id: 'jar_libertad_ahorro',
        name: 'Ahorro Mensual (10%)',
        category: 'ahorro',
        emoji: '💎',
        formulaMultiplier: 0.1, // sueldo base * 0.1
        formulaType: 'monthly',
        balance: 0,
        customTarget: null,
        description: 'Aporte mensual protegido del 10% para acumulación continua.'
      },
      {
        id: 'jar_libertad_gustos',
        name: 'Disponible / Gustos (20%)',
        category: 'gustos',
        emoji: '✨',
        formulaMultiplier: 0.2, // sueldo base * 0.2
        formulaType: 'monthly',
        balance: 0,
        customTarget: null,
        description: 'Margen libre del 20% para recreación, gustos personales y disfrute.'
      }
    ],
    comun: [
      {
        id: 'jar_comun_fijos',
        name: 'Gastos Fijos (50%)',
        category: 'fijos',
        emoji: '🏠',
        formulaMultiplier: 0.5, // sueldo base * 0.5
        formulaType: 'monthly',
        balance: 0,
        customTarget: null,
        description: 'Regla 50/30/20: 50% máximo para vivienda, alimentación y servicios básicos.'
      },
      {
        id: 'jar_comun_gustos',
        name: 'Gustos y Variables (30%)',
        category: 'gustos',
        emoji: '🏖️',
        formulaMultiplier: 0.3, // sueldo base * 0.3
        formulaType: 'monthly',
        balance: 0,
        customTarget: null,
        description: 'Regla 50/30/20: 30% destinado a estilo de vida, salidas y entretenimiento.'
      },
      {
        id: 'jar_comun_ahorro',
        name: 'Ahorro e Inversión (20%)',
        category: 'ahorro',
        emoji: '🪙',
        formulaMultiplier: 0.2, // sueldo base * 0.2
        formulaType: 'monthly',
        balance: 0,
        customTarget: null,
        description: 'Regla 50/30/20: 20% destinado a ahorro sistemático e inversión.'
      }
    ],
    personalizado: [
      {
        id: 'jar_custom_ahorro',
        name: 'Ahorro Personalizado',
        category: 'ahorro',
        emoji: '💰',
        formulaMultiplier: 0.2,
        formulaType: 'monthly',
        balance: 0,
        customTarget: null,
        description: 'Aporte mensual protegido según tu propia meta personalizada.'
      },
      {
        id: 'jar_custom_proyectos',
        name: 'Metas & Proyectos',
        category: 'proyectos',
        emoji: '🎯',
        formulaMultiplier: 0.15,
        formulaType: 'monthly',
        balance: 0,
        customTarget: null,
        description: 'Fondo acumulativo para viajes, compras o emprendimientos.'
      }
    ]
  };

  const defaultCustomSchemeSettings = {
    fixedPercent: 50,
    freePercent: 30,
    savingsPercent: 20
  };

  // Initial Clean State
  const defaultState = {
    hasCompletedOnboarding: false,
    monthlyIncome: 0,
    savingsBalance: 0,
    savingsTarget: 1000000,
    savingsRulePercent: 20,
    savingsRuleAmount: null,
    activeScheme: 'libertad_financiera', // 'libertad_financiera' | 'comun' | 'personalizado'
    activeJarId: 'jar_libertad_ahorro',
    customSchemeSettings: JSON.parse(JSON.stringify(defaultCustomSchemeSettings)),
    jars: JSON.parse(JSON.stringify(defaultJarsConfig)),
    fixedExpenses: [],
    goals: [],
    cards: [],
    installments: []
  };

  // Internal reactive listeners
  const listeners = [];

  function loadState() {
    try {
      let saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        saved = localStorage.getItem('finansy_data_v5') || localStorage.getItem('finansy_data_v4');
      }

      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = { ...defaultState, ...parsed };

        // Depurar jarras eliminadas de versiones anteriores
        const legacyJarIds = ['jar_libertad_emergencia', 'jar_libertad_invertido', 'jar_comun_emergencia', 'jar_custom_emergencia'];
        
        if (!merged.jars) {
          merged.jars = JSON.parse(JSON.stringify(defaultJarsConfig));
        } else {
          for (const schemeKey in merged.jars) {
            if (Array.isArray(merged.jars[schemeKey])) {
              merged.jars[schemeKey] = merged.jars[schemeKey].filter(j => !legacyJarIds.includes(j.id));
              if (merged.jars[schemeKey].length === 0 && defaultJarsConfig[schemeKey]) {
                merged.jars[schemeKey] = JSON.parse(JSON.stringify(defaultJarsConfig[schemeKey]));
              }
            }
          }
          if (!merged.jars.personalizado || merged.jars.personalizado.length === 0) {
            merged.jars.personalizado = JSON.parse(JSON.stringify(defaultJarsConfig.personalizado));
          }
          if (!merged.jars.libertad_financiera || merged.jars.libertad_financiera.length === 0) {
            merged.jars.libertad_financiera = JSON.parse(JSON.stringify(defaultJarsConfig.libertad_financiera));
          }
          if (!merged.jars.comun || merged.jars.comun.length === 0) {
            merged.jars.comun = JSON.parse(JSON.stringify(defaultJarsConfig.comun));
          }
        }

        if (!merged.customSchemeSettings) {
          merged.customSchemeSettings = JSON.parse(JSON.stringify(defaultCustomSchemeSettings));
        }

        if (!merged.activeScheme) merged.activeScheme = 'libertad_financiera';
        const currentJars = merged.jars[merged.activeScheme] || [];
        if (!merged.activeJarId || !currentJars.some(j => j.id === merged.activeJarId)) {
          merged.activeJarId = currentJars[0]?.id || 'jar_libertad_ahorro';
        }

        return merged;
      }
    } catch (e) {
      console.warn('Error reading from localStorage, using clean defaults:', e);
    }
    return JSON.parse(JSON.stringify(defaultState));
  }

  let state = loadState();

  function saveState() {
    try {
      const activeJars = state.jars[state.activeScheme] || [];
      const totalJarsBalance = activeJars.reduce((acc, j) => acc + (Number(j.balance) || 0), 0);
      state.savingsBalance = totalJarsBalance;

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

  // --- Dynamic Jars & Schemes Operations ---

  function setActiveScheme(schemeName) {
    if (schemeName !== 'libertad_financiera' && schemeName !== 'comun' && schemeName !== 'personalizado') return;
    state.activeScheme = schemeName;
    
    const currentJars = state.jars[schemeName] || [];
    if (currentJars.length > 0) {
      state.activeJarId = currentJars[0].id;
    }

    // Ajustar porcentaje de ahorro sugerido según el esquema
    if (schemeName === 'libertad_financiera') {
      state.savingsRulePercent = 10;
    } else if (schemeName === 'comun') {
      state.savingsRulePercent = 20;
    } else if (schemeName === 'personalizado') {
      state.savingsRulePercent = state.customSchemeSettings.savingsPercent || 20;
    }

    if (state.monthlyIncome > 0) {
      state.savingsRuleAmount = Math.round(state.monthlyIncome * (state.savingsRulePercent / 100));
    }

    saveState();
  }

  function setActiveJar(jarId) {
    const activeJars = state.jars[state.activeScheme] || [];
    const found = activeJars.find(j => j.id === jarId);
    if (found) {
      state.activeJarId = jarId;
      saveState();
    }
  }

  function calculateJarTarget(jar, income = null) {
    if (!jar) return 1000000;
    if (jar.customTarget && Number(jar.customTarget) > 0) {
      return Number(jar.customTarget);
    }
    const inc = income !== null ? Number(income) : (Number(state.monthlyIncome) || 0);
    const multiplier = Number(jar.formulaMultiplier) || 1;
    const calc = inc * multiplier;
    return calc > 0 ? Math.round(calc) : (jar.formulaMultiplier >= 1 ? 1000000 : 200000);
  }

  function getActiveJar() {
    const activeJars = state.jars[state.activeScheme] || [];
    let jar = activeJars.find(j => j.id === state.activeJarId);
    if (!jar && activeJars.length > 0) {
      jar = activeJars[0];
      state.activeJarId = jar.id;
    }
    return jar;
  }

  function depositToJar(jarId, amount) {
    const num = Math.max(0, Number(amount) || 0);
    if (num <= 0) return;

    let targetJar = null;
    for (const scheme in state.jars) {
      const j = state.jars[scheme].find(x => x.id === jarId);
      if (j) {
        j.balance = (Number(j.balance) || 0) + num;
        targetJar = j;
        break;
      }
    }

    if (targetJar) {
      saveState();
    }
  }

  function withdrawFromJar(jarId, amount) {
    const num = Math.max(0, Number(amount) || 0);
    if (num <= 0) return;

    let targetJar = null;
    for (const scheme in state.jars) {
      const j = state.jars[scheme].find(x => x.id === jarId);
      if (j) {
        j.balance = Math.max(0, (Number(j.balance) || 0) - num);
        targetJar = j;
        break;
      }
    }

    if (targetJar) {
      saveState();
    }
  }

  function updateJar(jarId, updates) {
    for (const scheme in state.jars) {
      const j = state.jars[scheme].find(x => x.id === jarId);
      if (j) {
        if (updates.balance !== undefined) j.balance = Math.max(0, Number(updates.balance) || 0);
        if (updates.customTarget !== undefined) {
          j.customTarget = updates.customTarget ? Math.max(0, Number(updates.customTarget) || 0) : null;
        }
        if (updates.name !== undefined) j.name = updates.name.trim() || j.name;
        if (updates.emoji !== undefined) j.emoji = updates.emoji || j.emoji;
        if (updates.formulaMultiplier !== undefined) j.formulaMultiplier = Number(updates.formulaMultiplier) || j.formulaMultiplier;
        if (updates.formulaType !== undefined) j.formulaType = updates.formulaType;
        if (updates.description !== undefined) j.description = updates.description;
        saveState();
        break;
      }
    }
  }

  function addCustomJar(jarData) {
    const newJar = {
      id: 'jar_custom_' + Date.now(),
      name: jarData.name.trim() || 'Nueva Jarra Personalizada',
      category: jarData.category || 'personalizado',
      emoji: jarData.emoji || '🏺',
      formulaMultiplier: Number(jarData.formulaMultiplier) || 0.1,
      formulaType: jarData.formulaType || 'monthly',
      balance: Number(jarData.balance) || 0,
      customTarget: jarData.customTarget ? Number(jarData.customTarget) : null,
      description: jarData.description || 'Jarra configurada según tus preferencias personales.'
    };

    if (!state.jars.personalizado) state.jars.personalizado = [];
    state.jars.personalizado.push(newJar);
    state.activeJarId = newJar.id;
    saveState();
  }

  function deleteCustomJar(jarId) {
    if (!state.jars.personalizado) return;
    state.jars.personalizado = state.jars.personalizado.filter(j => j.id !== jarId);
    if (state.activeJarId === jarId) {
      state.activeJarId = state.jars.personalizado[0]?.id || null;
    }
    saveState();
  }

  function updateCustomSchemeSettings(settings) {
    if (!state.customSchemeSettings) {
      state.customSchemeSettings = JSON.parse(JSON.stringify(defaultCustomSchemeSettings));
    }
    if (settings.fixedPercent !== undefined) {
      state.customSchemeSettings.fixedPercent = Math.max(0, Math.min(100, Number(settings.fixedPercent) || 50));
    }
    if (settings.freePercent !== undefined) {
      state.customSchemeSettings.freePercent = Math.max(0, Math.min(100, Number(settings.freePercent) || 30));
    }
    if (settings.savingsPercent !== undefined) {
      state.customSchemeSettings.savingsPercent = Math.max(0, Math.min(100, Number(settings.savingsPercent) || 20));
      if (state.activeScheme === 'personalizado') {
        state.savingsRulePercent = state.customSchemeSettings.savingsPercent;
        if (state.monthlyIncome > 0) {
          state.savingsRuleAmount = Math.round(state.monthlyIncome * (state.savingsRulePercent / 100));
        }
      }
    }
    if (settings.emergencyMonths !== undefined) {
      state.customSchemeSettings.emergencyMonths = Math.max(1, Number(settings.emergencyMonths) || 6);
      const emgJar = state.jars.personalizado?.find(j => j.category === 'emergencia');
      if (emgJar) emgJar.formulaMultiplier = state.customSchemeSettings.emergencyMonths;
    }
    if (settings.freedomMultiplier !== undefined) {
      state.customSchemeSettings.freedomMultiplier = Math.max(1, Number(settings.freedomMultiplier) || 150);
    }
    saveState();
  }

  function getTotalSavings() {
    const activeJars = state.jars[state.activeScheme] || [];
    const jarsSum = activeJars.reduce((acc, j) => acc + (Number(j.balance) || 0), 0);
    const goalsSum = state.goals.reduce((acc, g) => acc + (Number(g.current) || 0), 0);
    return jarsSum + goalsSum;
  }

  // --- Core Operations ---

  function setOnboardingCompleted(completed = true) {
    state.hasCompletedOnboarding = !!completed;
    saveState();
  }

  function updateIncome(amount) {
    state.monthlyIncome = Math.max(0, Number(amount) || 0);
    if (state.savingsRuleAmount && state.monthlyIncome > 0) {
      state.savingsRulePercent = Number(((state.savingsRuleAmount / state.monthlyIncome) * 100).toFixed(2));
    } else if (state.monthlyIncome > 0) {
      state.savingsRuleAmount = Math.round(state.monthlyIncome * (state.savingsRulePercent / 100));
    }
    saveState();
  }

  function updateSavingsBalance(amount) {
    const jar = getActiveJar();
    if (jar) {
      jar.balance = Math.max(0, Number(amount) || 0);
    }
    saveState();
  }

  function depositSavings(amount) {
    const jar = getActiveJar();
    if (jar) {
      depositToJar(jar.id, amount);
    }
  }

  function withdrawSavings(amount) {
    const jar = getActiveJar();
    if (jar) {
      withdrawFromJar(jar.id, amount);
    }
  }

  function updateSavingsTarget(amount) {
    const jar = getActiveJar();
    if (jar) {
      jar.customTarget = Math.max(0, Number(amount) || 0);
      saveState();
    }
  }

  function updateJarSettings({ balance, target, rulePercent, ruleAmount }) {
    const jar = getActiveJar();
    if (jar) {
      if (balance !== undefined && balance !== '') jar.balance = Math.max(0, Number(balance) || 0);
      if (target !== undefined && target !== '') jar.customTarget = Math.max(0, Number(target) || 0);
    }

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
    const target = Math.max(1, Number(goal.target) || 100000);
    const current = Math.max(0, Math.min(target, Number(goal.current) || 0));
    state.goals.push({
      id: 'goal_' + Date.now(),
      name: goal.name.trim() || 'Nueva Meta',
      target: target,
      current: current,
      emoji: goal.emoji || '🎯'
    });
    saveState();
  }

  function updateGoalAmount(id, delta) {
    const goal = state.goals.find(g => g.id === id);
    if (goal) {
      const newAmount = (Number(goal.current) || 0) + Number(delta);
      goal.current = Math.max(0, Math.min(goal.target, newAmount));
      saveState();
    }
  }

  function deleteGoal(id, transferToActiveJar = false) {
    const goal = state.goals.find(g => g.id === id);
    if (goal && transferToActiveJar && (Number(goal.current) || 0) > 0) {
      depositSavings(goal.current);
    }
    state.goals = state.goals.filter(g => g.id !== id);
    saveState();
  }

  function addCard(card) {
    const isDebit = card.type === 'debito';
    state.cards.push({
      id: 'card_' + Date.now(),
      alias: card.alias.trim() || (isDebit ? 'Mi Débito' : 'Mi Tarjeta'),
      type: card.type || 'credito',
      color: card.color || 'gradient-dark',
      limit: isDebit ? 0 : (Number(card.limit) || 0),
      used: isDebit ? 0 : (Number(card.used) || 0),
      interestRate: isDebit ? 0 : (Number(card.interestRate) || 0),
      billingDay: isDebit ? null : (Number(card.billingDay) || 15),
      paymentDueDay: isDebit ? null : (Number(card.paymentDueDay) || 5),
      reminderDaysBefore: isDebit ? null : (Number(card.reminderDaysBefore) || 3),
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
    const total = Math.max(1, Number(inst.totalInstallments) || Number(inst.remainingMonths) || 1);
    const current = Math.max(1, Math.min(total, Number(inst.currentInstallment) || 1));
    const remaining = Math.max(1, Number(inst.remainingMonths) !== undefined && !isNaN(Number(inst.remainingMonths)) ? Number(inst.remainingMonths) : (total - current + 1));

    state.installments.push({
      id: 'inst_' + Date.now(),
      name: inst.name.trim() || 'Compra en Cuotas',
      monthlyAmount: Number(inst.monthlyAmount) || 0,
      totalInstallments: total,
      currentInstallment: current,
      remainingMonths: remaining,
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

  function advanceInstallment(id) {
    const inst = state.installments.find(i => i.id === id);
    if (!inst) return;

    if (inst.remainingMonths > 1) {
      inst.remainingMonths -= 1;
      if (inst.currentInstallment) {
        inst.currentInstallment = Math.min(inst.totalInstallments || inst.remainingMonths, inst.currentInstallment + 1);
      }
      saveState();
    } else {
      // Completada la última cuota: eliminar deudas activas
      state.installments = state.installments.filter(i => i.id !== id);
      saveState();
    }
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
    setActiveScheme,
    setActiveJar,
    getActiveJar,
    calculateJarTarget,
    depositToJar,
    withdrawFromJar,
    updateJar,
    addCustomJar,
    deleteCustomJar,
    updateCustomSchemeSettings,
    getTotalSavings,
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
    advanceInstallment,
    deleteInstallment,
    resetAllData,
    loadSampleData
  };
})();
