/**
 * FINANSY — JARRA DINÁMICA & AHORROS VIEW
 * Manejo de valores flotantes exactos, jarra visual líquida, capacidad de ahorro en $ y % y gestión de gastos/cuotas.
 */

const FinanJarra = (() => {

  function render(state) {
    const { formatMoney, formatPercent } = FinanStore;

    const income = Number(state.monthlyIncome) || 0;
    const savings = Number(state.savingsBalance) || 0;
    const target = Number(state.savingsTarget) || 1000000;
    const rulePercent = state.savingsRulePercent !== undefined ? Number(state.savingsRulePercent) : 20;

    // Gastos Fijos totales
    const totalFixed = state.fixedExpenses.reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);

    // Compromisos en cuotas mensuales actuales
    const totalInstallments = state.installments.reduce((acc, inst) => acc + (Number(inst.monthlyAmount) || 0), 0);

    // Ahorro mensual sugerido / protegido
    let suggestedSavings = 0;
    if (state.savingsRuleAmount && Number(state.savingsRuleAmount) > 0) {
      suggestedSavings = Number(state.savingsRuleAmount);
    } else {
      suggestedSavings = Math.round(income * (rulePercent / 100));
    }

    // Capacidad mensual libre (Ingreso - Gastos fijos - Cuotas)
    const monthlyCapacity = Math.max(0, income - totalFixed - totalInstallments);
    const freeDiscretionary = Math.max(0, monthlyCapacity - suggestedSavings);

    // Porcentaje de llenado de la jarra (relativo a la meta)
    const fillPercent = target > 0 ? Math.min(100, Math.max(0, Number(((savings / target) * 100).toFixed(1)))) : 0;

    // Actualizar elementos visuales de la Jarra
    const liquidFillEl = document.getElementById('jar-liquid-fill');
    const percentTextEl = document.getElementById('jar-percentage-text');
    const currentAmountEl = document.getElementById('jar-current-amount-display');
    const goalRefEl = document.getElementById('jar-goal-reference-text');

    if (liquidFillEl) {
      liquidFillEl.style.height = `${fillPercent}%`;
    }

    if (percentTextEl) {
      percentTextEl.textContent = `${fillPercent}%`;
    }

    if (currentAmountEl) {
      currentAmountEl.innerHTML = `${formatMoney(savings)} <button class="btn-mini-jar-edit" id="btn-edit-jar-balance" title="Editar saldo en jarra">✏️</button>`;
    }

    if (goalRefEl) {
      goalRefEl.innerHTML = `de meta ${formatMoney(target)} <span class="jar-edit-hint">✏️</span>`;
    }

    // Actualizar Marcas laterales de la jarra
    const markTop = document.getElementById('mark-top-val');
    const mark75 = document.getElementById('mark-75-val');
    const mark50 = document.getElementById('mark-50-val');
    const mark25 = document.getElementById('mark-25-val');

    if (markTop) markTop.textContent = `${formatMoney(target)} (Meta)`;
    if (mark75) mark75.textContent = formatMoney(target * 0.75);
    if (mark50) mark50.textContent = formatMoney(target * 0.50);
    if (mark25) mark25.textContent = formatMoney(target * 0.25);

    // Footer de la jarra (Capacidad de Ahorro y Regla en $ y %)
    const capEl = document.getElementById('jar-monthly-capacity');
    const ruleEl = document.getElementById('jar-suggested-rule');

    if (capEl) capEl.textContent = `${formatMoney(monthlyCapacity)} / mes`;
    if (ruleEl) {
      ruleEl.innerHTML = `<span class="rule-clickable-btn" id="btn-edit-rule-percent" title="Cambiar capacidad de ahorro (${formatMoney(suggestedSavings)} o ${formatPercent(rulePercent)})">${formatPercent(rulePercent)} (${formatMoney(suggestedSavings)}/mes) ✏️</span>`;
    }

    // Actualizar Barras de Distribución de Dinero
    const fixedValEl = document.getElementById('budget-fixed-val');
    const fixedFillEl = document.getElementById('bar-fixed-fill');
    const instValEl = document.getElementById('budget-installments-val');
    const instFillEl = document.getElementById('bar-installments-fill');
    const savValEl = document.getElementById('budget-savings-val');
    const savFillEl = document.getElementById('bar-savings-fill');
    const freeValEl = document.getElementById('budget-free-val');
    const freeFillEl = document.getElementById('bar-free-fill');

    if (fixedValEl) fixedValEl.textContent = formatMoney(totalFixed);
    if (instValEl) instValEl.textContent = formatMoney(totalInstallments);
    if (savValEl) savValEl.textContent = formatMoney(suggestedSavings);
    if (freeValEl) freeValEl.textContent = formatMoney(freeDiscretionary);

    if (income > 0) {
      const pFixed = Math.min(100, Math.round((totalFixed / income) * 100));
      const pInst = Math.min(100, Math.round((totalInstallments / income) * 100));
      const pSav = Math.min(100, Math.round((suggestedSavings / income) * 100));
      const pFree = Math.max(0, 100 - pFixed - pInst - pSav);

      if (fixedFillEl) fixedFillEl.style.width = `${pFixed}%`;
      if (instFillEl) instFillEl.style.width = `${pInst}%`;
      if (savFillEl) savFillEl.style.width = `${pSav}%`;
      if (freeFillEl) freeFillEl.style.width = `${pFree}%`;
    }

    // Renderizar Lista de Gastos Fijos
    renderExpensesList(state.fixedExpenses);

    // Renderizar Lista de Compromisos en Cuotas / Deudas Activas
    renderInstallmentsList(state.installments);

    // Conectar eventos de edición rápida de la jarra
    setupJarClickEvents();
  }

  function setupJarClickEvents() {
    const goalRefEl = document.getElementById('jar-goal-reference-text');
    const btnEditBalance = document.getElementById('btn-edit-jar-balance');
    const btnEditRule = document.getElementById('btn-edit-rule-percent');

    const openSettings = () => {
      const current = FinanStore.getState();
      const inputBalance = document.getElementById('input-jar-balance');
      const inputTarget = document.getElementById('input-jar-target');
      const inputRule = document.getElementById('input-jar-rule');
      const inputRuleAmount = document.getElementById('input-jar-rule-amount');

      if (inputBalance) inputBalance.value = current.savingsBalance || '';
      if (inputTarget) inputTarget.value = current.savingsTarget || '';
      
      const pct = current.savingsRulePercent !== undefined ? current.savingsRulePercent : 20;
      if (inputRule) inputRule.value = pct;

      const inc = current.monthlyIncome || 0;
      const amt = current.savingsRuleAmount || (inc > 0 ? Math.round(inc * (pct / 100)) : 0);
      if (inputRuleAmount) inputRuleAmount.value = amt || '';

      // Configurar sincronización bidireccional en tiempo real entre % y $
      setupBidirectionalRuleSync(inc);

      FinanApp.openModal('modal-jar-settings');
    };

    if (goalRefEl) goalRefEl.onclick = openSettings;
    if (btnEditBalance) btnEditBalance.onclick = openSettings;
    if (btnEditRule) btnEditRule.onclick = openSettings;
  }

  function setupBidirectionalRuleSync(income) {
    const inputRule = document.getElementById('input-jar-rule');
    const inputRuleAmount = document.getElementById('input-jar-rule-amount');
    if (!inputRule || !inputRuleAmount) return;

    inputRule.oninput = () => {
      const pct = parseFloat(inputRule.value);
      if (!isNaN(pct) && income > 0) {
        inputRuleAmount.value = parseFloat(((income * pct) / 100).toFixed(2));
      }
    };

    inputRuleAmount.oninput = () => {
      const amt = parseFloat(inputRuleAmount.value);
      if (!isNaN(amt) && income > 0) {
        inputRule.value = parseFloat(((amt / income) * 100).toFixed(2));
      }
    };
  }

  function renderExpensesList(expenses) {
    const { formatMoney } = FinanStore;
    const container = document.getElementById('fixed-expenses-list-container');
    if (!container) return;

    if (!expenses || expenses.length === 0) {
      container.innerHTML = `<div class="text-subtle" style="padding: 0.75rem; text-align: center;">No hay gastos fijos registrados.</div>`;
      return;
    }

    container.innerHTML = expenses.map(exp => `
      <div class="expense-item-row">
        <div class="expense-item-info">
          <span>🏷️</span>
          <span>${escapeHtml(exp.name)}</span>
        </div>
        <div class="expense-item-right">
          <span class="expense-item-price">${formatMoney(exp.amount)}</span>
          <button class="btn-del-expense" data-expense-id="${exp.id}" title="Eliminar gasto">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-del-expense').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-expense-id');
        FinanStore.deleteExpense(id);
        FinanApp.showToast('Gasto fijo eliminado', 'info');
      });
    });
  }

  function renderInstallmentsList(installments) {
    const { formatMoney } = FinanStore;
    const container = document.getElementById('installments-list-container');
    if (!container) return;

    if (!installments || installments.length === 0) {
      container.innerHTML = `<div class="text-subtle" style="padding: 0.75rem; text-align: center;">No tienes compromisos en cuotas ni deudas activas.</div>`;
      return;
    }

    container.innerHTML = installments.map(inst => `
      <div class="expense-item-row installment-row">
        <div class="expense-item-info">
          <span>💳</span>
          <div>
            <span>${escapeHtml(inst.name)}</span>
            <small class="text-subtle" style="display:block; font-size: 0.72rem;">${inst.remainingMonths ? `${inst.remainingMonths} meses restantes` : 'Cuota mensual'}</small>
          </div>
        </div>
        <div class="expense-item-right">
          <span class="expense-item-price text-amber">${formatMoney(inst.monthlyAmount)}</span>
          <button class="btn-del-expense" data-installment-id="${inst.id}" title="Eliminar / Finalizar deuda">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-installment-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-installment-id');
        FinanStore.deleteInstallment(id);
        FinanApp.showToast('Compromiso en cuotas eliminado con éxito', 'info');
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    render
  };
})();
