/**
 * FINANSY — JARRA DINÁMICA & AHORROS VIEW
 * Manejo de jarras dinámicas según esquema activo (Libertad Financiera, Común o Personalizado),
 * creación de jarras a la medida, visualización líquida animada, hitos y reglas automáticas.
 */

const FinanJarra = (() => {

  function render(state) {
    const { formatMoney, formatPercent } = FinanStore;

    const income = Number(state.monthlyIncome) || 0;
    const activeScheme = state.activeScheme || 'libertad_financiera';
    const activeJars = state.jars[activeScheme] || [];
    const activeJar = FinanStore.getActiveJar();
    const customSettings = state.customSchemeSettings || { fixedPercent: 50, freePercent: 30, savingsPercent: 20, emergencyMonths: 6, freedomMultiplier: 150 };

    // 1. Selector de Esquema en la vista de Jarras
    renderSchemeSelector(activeScheme);

    // 2. Selector de Jarras Dinámicas (Pills)
    renderJarsSelectorPills(activeJars, state.activeJarId, income, activeScheme);

    // 3. Cálculos de la Jarra Activa
    const jarBalance = Number(activeJar?.balance) || 0;
    const jarTarget = FinanStore.calculateJarTarget(activeJar, income);
    const fillPercent = jarTarget > 0 ? Math.min(100, Math.max(0, Number(((jarBalance / jarTarget) * 100).toFixed(1)))) : 0;

    // Actualizar elementos visuales de la Jarra Activa
    const liquidFillEl = document.getElementById('jar-liquid-fill');
    const percentTextEl = document.getElementById('jar-percentage-text');
    const currentAmountEl = document.getElementById('jar-current-amount-display');
    const goalRefEl = document.getElementById('jar-goal-reference-text');
    const jarActiveTagEl = document.getElementById('jar-active-tag');

    if (liquidFillEl) {
      liquidFillEl.style.height = `${fillPercent}%`;
    }

    if (percentTextEl) {
      percentTextEl.textContent = `${fillPercent}%`;
    }

    if (jarActiveTagEl && activeJar) {
      const isCustom = activeScheme === 'personalizado';
      jarActiveTagEl.innerHTML = `
        <span>${activeJar.emoji || '🏺'} ${escapeHtml(activeJar.name)}</span>
        ${isCustom && activeJars.length > 1 ? `<button type="button" class="btn-del-custom-jar" id="btn-del-active-jar" title="Eliminar esta jarra personalizada">🗑️</button>` : ''}
      `;

      document.getElementById('btn-del-active-jar')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`¿Eliminar la jarra "${activeJar.name}"?`)) {
          FinanStore.deleteCustomJar(activeJar.id);
          FinanApp.showToast('Jarra personalizada eliminada', 'info');
        }
      });
    }

    if (currentAmountEl) {
      currentAmountEl.innerHTML = `${formatMoney(jarBalance)} <button class="btn-mini-jar-edit" id="btn-edit-jar-balance" title="Editar saldo en jarra">✏️</button>`;
    }

    if (goalRefEl) {
      goalRefEl.innerHTML = `de meta ${formatMoney(jarTarget)} <span class="jar-edit-hint">✏️</span>`;
    }

    // Actualizar Marcas laterales de la jarra
    const markTop = document.getElementById('mark-top-val');
    const mark75 = document.getElementById('mark-75-val');
    const mark50 = document.getElementById('mark-50-val');
    const mark25 = document.getElementById('mark-25-val');

    if (markTop) markTop.textContent = `${formatMoney(jarTarget)} (Meta)`;
    if (mark75) mark75.textContent = formatMoney(jarTarget * 0.75);
    if (mark50) mark50.textContent = formatMoney(jarTarget * 0.50);
    if (mark25) mark25.textContent = formatMoney(jarTarget * 0.25);

    // Gastos Fijos totales y cuotas
    const totalFixed = state.fixedExpenses.reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);
    const totalInstallments = state.installments.reduce((acc, inst) => acc + (Number(inst.monthlyAmount) || 0), 0);

    let rulePercent = 20;
    if (activeScheme === 'libertad_financiera') rulePercent = 10;
    else if (activeScheme === 'comun') rulePercent = 20;
    else if (activeScheme === 'personalizado') rulePercent = customSettings.savingsPercent || 20;

    let suggestedSavings = 0;
    if (state.savingsRuleAmount && Number(state.savingsRuleAmount) > 0) {
      suggestedSavings = Number(state.savingsRuleAmount);
    } else {
      suggestedSavings = Math.round(income * (rulePercent / 100));
    }

    const monthlyCapacity = Math.max(0, income - totalFixed - totalInstallments);
    const freeDiscretionary = Math.max(0, monthlyCapacity - suggestedSavings);

    // Footer de la jarra
    const capEl = document.getElementById('jar-monthly-capacity');
    const ruleEl = document.getElementById('jar-suggested-rule');

    if (capEl) capEl.textContent = `${formatMoney(monthlyCapacity)} / mes`;
    if (ruleEl) {
      ruleEl.innerHTML = `<span class="rule-clickable-btn" id="btn-edit-rule-percent" title="Cambiar regla de ahorro (${formatMoney(suggestedSavings)} o ${formatPercent(rulePercent)})">${formatPercent(rulePercent)} (${formatMoney(suggestedSavings)}/mes) ✏️</span>`;
    }

    // 4. Renderizar Tarjeta de Directrices del Esquema Activo
    renderSchemeGuidelinesCard(activeScheme, income, totalFixed, totalInstallments, suggestedSavings, freeDiscretionary, customSettings);

    // 5. Actualizar Barras de Distribución de Dinero
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

    // Renderizar Lista de Compromisos en Cuotas
    renderInstallmentsList(state.installments);

    // Conectar eventos de edición rápida de la jarra
    setupJarClickEvents();
  }

  function renderSchemeSelector(activeScheme) {
    const btnLibertad = document.getElementById('btn-jar-scheme-libertad');
    const btnComun = document.getElementById('btn-jar-scheme-comun');
    const btnPersonalizado = document.getElementById('btn-jar-scheme-personalizado');

    if (btnLibertad) {
      btnLibertad.classList.toggle('active', activeScheme === 'libertad_financiera');
      btnLibertad.onclick = () => {
        FinanStore.setActiveScheme('libertad_financiera');
        FinanApp.showToast('Esquema cambiado a Libertad Financiera (F.I.R.E.)', 'success');
      };
    }

    if (btnComun) {
      btnComun.classList.toggle('active', activeScheme === 'comun');
      btnComun.onclick = () => {
        FinanStore.setActiveScheme('comun');
        FinanApp.showToast('Esquema cambiado a Regla Común (50/30/20)', 'info');
      };
    }

    if (btnPersonalizado) {
      btnPersonalizado.classList.toggle('active', activeScheme === 'personalizado');
      btnPersonalizado.onclick = () => {
        FinanStore.setActiveScheme('personalizado');
        FinanApp.showToast('Esquema cambiado a Personalizado', 'success');
      };
    }
  }

  function renderJarsSelectorPills(jars, activeJarId, income, activeScheme) {
    const { formatMoney } = FinanStore;
    const container = document.getElementById('jars-selector-pills-container');
    if (!container) return;

    let html = jars.map(jar => {
      const target = FinanStore.calculateJarTarget(jar, income);
      const balance = Number(jar.balance) || 0;
      const pct = target > 0 ? Math.min(100, Math.round((balance / target) * 100)) : 0;
      const isActive = jar.id === activeJarId;

      return `
        <button type="button" class="jar-pill-btn ${isActive ? 'active' : ''}" data-select-jar-id="${jar.id}">
          <span class="jar-pill-emoji">${jar.emoji || '🏺'}</span>
          <div class="jar-pill-texts">
            <strong>${escapeHtml(jar.name)}</strong>
            <small>${formatMoney(balance)} / ${formatMoney(target)} (${pct}%)</small>
          </div>
        </button>
      `;
    }).join('');

    if (activeScheme === 'personalizado') {
      html += `
        <button type="button" class="jar-pill-btn-add" id="btn-add-custom-jar-pill" title="Crear nueva jarra personalizada">
          <span>➕</span>
          <span>Nueva Jarra</span>
        </button>
      `;
    }

    container.innerHTML = html;

    container.querySelectorAll('[data-select-jar-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-select-jar-id');
        FinanStore.setActiveJar(id);
      });
    });

    document.getElementById('btn-add-custom-jar-pill')?.addEventListener('click', () => {
      FinanApp.openCustomJarModal();
    });
  }

  function renderSchemeGuidelinesCard(activeScheme, income, totalFixed, totalInstallments, suggestedSavings, freeDiscretionary, customSettings) {
    const { formatMoney } = FinanStore;
    const container = document.getElementById('jar-scheme-guidelines-box');
    if (!container) return;

    if (activeScheme === 'libertad_financiera') {
      const fixedMax = income * 0.7;
      const isFixedOk = totalFixed <= fixedMax;

      container.innerHTML = `
        <div class="scheme-guidelines-header">
          <div>
            <h4>🌟 Tipo de Ahorro: Libertad Financiera</h4>
            <p class="text-subtle">Fórmulas calculadas en tiempo real según tu sueldo base.</p>
          </div>
        </div>

        <div class="scheme-rules-grid">
          <div class="scheme-rule-item">
            <span class="rule-bullet">🚀</span>
            <div class="rule-detail">
              <strong>Invertido (sueldo base * 200)</strong>
              <div class="rule-calc-val">${formatMoney(income * 200)}</div>
              <small class="text-subtle">Meta patrimonial para independencia y vivir de rentas.</small>
            </div>
          </div>

          <div class="scheme-rule-item">
            <span class="rule-bullet">💎</span>
            <div class="rule-detail">
              <strong>Ahorro (sueldo base * 0.10)</strong>
              <div class="rule-calc-val">${formatMoney(income * 0.10)} / mes</div>
              <small class="text-subtle">Aporte mensual continuo del 10%.</small>
            </div>
          </div>

          <div class="scheme-rule-item">
            <span class="rule-bullet">🛡️</span>
            <div class="rule-detail">
              <strong>Fondo de emergencia (sueldo base * 4)</strong>
              <div class="rule-calc-val">${formatMoney(income * 4)}</div>
              <small class="text-subtle">Colchón de tranquilidad de 4 meses de ingresos.</small>
            </div>
          </div>

          <div class="scheme-rule-item">
            <span class="rule-bullet">✨</span>
            <div class="rule-detail">
              <strong>Disponible para ti o gustos (sueldo base * 0.20)</strong>
              <div class="rule-calc-val">${formatMoney(income * 0.20)} / mes</div>
              <small class="text-subtle">Margen libre para recreación y gastos sin culpa.</small>
            </div>
          </div>

          <div class="scheme-rule-item ${isFixedOk ? '' : 'rule-alert'}">
            <span class="rule-bullet">🏠</span>
            <div class="rule-detail">
              <strong>Máximo gastos fijos (sueldo base * 0.70)</strong>
              <div class="rule-calc-val ${isFixedOk ? 'text-emerald' : 'text-rose'}">${formatMoney(totalFixed)} (Tope: ${formatMoney(fixedMax)})</div>
              <small class="text-subtle">${isFixedOk ? '✓ Dentro del límite saludable.' : '⚠️ Supera el 70% tope permitido.'}</small>
            </div>
          </div>
        </div>
      `;
    } else if (activeScheme === 'comun') {
      const fixedSuggested = income * 0.5;
      const isFixedOk = totalFixed <= fixedSuggested;

      container.innerHTML = `
        <div class="scheme-guidelines-header">
          <div>
            <h4>🔷 Tipo de Ahorro: Esquema Común</h4>
            <p class="text-subtle">Distribución clásica equilibrada 50 / 30 / 20.</p>
          </div>
        </div>

        <div class="scheme-rules-grid">
          <div class="scheme-rule-item ${isFixedOk ? '' : 'rule-alert'}">
            <span class="rule-bullet">🏠</span>
            <div class="rule-detail">
              <strong>Gastos fijos (sueldo base * 0.50)</strong>
              <div class="rule-calc-val ${isFixedOk ? 'text-emerald' : 'text-rose'}">${formatMoney(totalFixed)} (Ideal: ${formatMoney(fixedSuggested)})</div>
              <small class="text-subtle">${isFixedOk ? '✓ Cumples la meta del 50% para costos esenciales.' : '⚠️ Supera el 50% sugerido.'}</small>
            </div>
          </div>

          <div class="scheme-rule-item">
            <span class="rule-bullet">🏖️</span>
            <div class="rule-detail">
              <strong>Gustos o variables (sueldo base * 0.30)</strong>
              <div class="rule-calc-val">${formatMoney(income * 0.30)} / mes</div>
              <small class="text-subtle">30% del ingreso para estilo de vida, salidas y hobbies.</small>
            </div>
          </div>

          <div class="scheme-rule-item">
            <span class="rule-bullet">🪙</span>
            <div class="rule-detail">
              <strong>Ahorro e inversión (sueldo base * 0.20)</strong>
              <div class="rule-calc-val">${formatMoney(income * 0.20)} / mes</div>
              <small class="text-subtle">20% protegido para construir tu futuro y patrimonio.</small>
            </div>
          </div>
        </div>
      `;
    } else {
      // Esquema Personalizado
      const fixedMax = income * ((customSettings.fixedPercent || 50) / 100);
      const isFixedOk = totalFixed <= fixedMax;

      container.innerHTML = `
        <div class="scheme-guidelines-header">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h4>⚙️ Tipo de Ahorro: Personalizado</h4>
              <p class="text-subtle">Tus metas, jarras y porcentajes diseñados a tu medida.</p>
            </div>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn-xs btn-outline" id="btn-edit-custom-scheme-rules">⚙️ Configurar Reglas</button>
              <button class="btn-xs btn-primary" id="btn-add-custom-jar-action">+ Añadir Jarra</button>
            </div>
          </div>
        </div>

        <div class="scheme-rules-grid">
          <div class="scheme-rule-item ${isFixedOk ? '' : 'rule-alert'}">
            <span class="rule-bullet">🏠</span>
            <div class="rule-detail">
              <strong>Gastos Fijos Personalizados (${customSettings.fixedPercent || 50}%)</strong>
              <div class="rule-calc-val ${isFixedOk ? 'text-emerald' : 'text-rose'}">${formatMoney(totalFixed)} (Objetivo: ${formatMoney(fixedMax)})</div>
              <small class="text-subtle">${isFixedOk ? '✓ Dentro de tu meta de costos fijos.' : '⚠️ Supera tu objetivo definido.'}</small>
            </div>
          </div>

          <div class="scheme-rule-item">
            <span class="rule-bullet">✨</span>
            <div class="rule-detail">
              <strong>Margen Libre / Gustos (${customSettings.freePercent || 30}%)</strong>
              <div class="rule-calc-val">${formatMoney(income * ((customSettings.freePercent || 30) / 100))} / mes</div>
              <small class="text-subtle">Destinado para tus proyectos personales y entretenimiento.</small>
            </div>
          </div>

          <div class="scheme-rule-item">
            <span class="rule-bullet">💰</span>
            <div class="rule-detail">
              <strong>Ahorro e Inversión (${customSettings.savingsPercent || 20}%)</strong>
              <div class="rule-calc-val">${formatMoney(income * ((customSettings.savingsPercent || 20) / 100))} / mes</div>
              <small class="text-subtle">Aporte mensual objetivo protegido.</small>
            </div>
          </div>

          <div class="scheme-rule-item">
            <span class="rule-bullet">🛡️</span>
            <div class="rule-detail">
              <strong>Fondo de Emergencia (${customSettings.emergencyMonths || 6} meses)</strong>
              <div class="rule-calc-val">${formatMoney(income * (customSettings.emergencyMonths || 6))}</div>
              <small class="text-subtle">Meta total calculada para tu respaldo financiero.</small>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-edit-custom-scheme-rules')?.addEventListener('click', () => {
        FinanApp.openCustomSchemeModal();
      });

      document.getElementById('btn-add-custom-jar-action')?.addEventListener('click', () => {
        FinanApp.openCustomJarModal();
      });
    }
  }

  function setupJarClickEvents() {
    const goalRefEl = document.getElementById('jar-goal-reference-text');
    const btnEditBalance = document.getElementById('btn-edit-jar-balance');
    const btnEditRule = document.getElementById('btn-edit-rule-percent');

    const openSettings = () => {
      const current = FinanStore.getState();
      const activeJar = FinanStore.getActiveJar();
      const inputBalance = document.getElementById('input-jar-balance');
      const inputTarget = document.getElementById('input-jar-target');
      const inputRule = document.getElementById('input-jar-rule');
      const inputRuleAmount = document.getElementById('input-jar-rule-amount');

      if (inputBalance && activeJar) inputBalance.value = activeJar.balance || '';
      if (inputTarget && activeJar) inputTarget.value = FinanStore.calculateJarTarget(activeJar) || '';
      
      const pct = current.savingsRulePercent !== undefined ? current.savingsRulePercent : 20;
      if (inputRule) inputRule.value = pct;

      const inc = current.monthlyIncome || 0;
      const amt = current.savingsRuleAmount || (inc > 0 ? Math.round(inc * (pct / 100)) : 0);
      if (inputRuleAmount) inputRuleAmount.value = amt || '';

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
