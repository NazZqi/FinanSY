/**
 * FINANSY — RESUMEN FINANCIERO & DASHBOARD MENSUAL
 * Visualización ejecutiva consolidada con KPIs, Gráfico Donut SVG de flujo de dinero,
 * comparativa del esquema activo (Libertad Financiera, Común, Personalizado),
 * proyecciones F.I.R.E. y Calendario Financiero Mensual interactivo.
 */

const FinanDashboard = (() => {

  // Variables de estado del calendario mensual
  let calCurrentDate = new Date();
  let calSelectedDay = null;

  function render(state) {
    const { formatMoney, formatPercent } = FinanStore;

    const income = Number(state.monthlyIncome) || 0;
    const activeScheme = state.activeScheme || 'libertad_financiera';
    const activeJars = state.jars[activeScheme] || [];
    const customSettings = state.customSchemeSettings || { fixedPercent: 50, freePercent: 30, savingsPercent: 20, emergencyMonths: 6, freedomMultiplier: 150 };

    // 1. Totales de Gastos Fijos y Cuotas
    const totalFixed = (state.fixedExpenses || []).reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);
    const totalInstallments = (state.installments || []).reduce((acc, inst) => acc + (Number(inst.monthlyAmount) || 0), 0);
    const totalCommitted = totalFixed + totalInstallments;

    // Ahorro mensual sugerido
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

    const monthlySaved = Number(state.monthlySavingsFromIncome) || 0;
    const available = Math.max(0, income - totalCommitted - monthlySaved);
    const freeDiscretionary = Math.max(0, available - suggestedSavings);

    // Patrimonio total (Jarras + Metas)
    const totalSavings = FinanStore.getTotalSavings();
    const totalGoals = (state.goals || []).reduce((acc, g) => acc + (Number(g.current) || 0), 0);

    // Tarjetas y deuda
    const creditCards = (state.cards || []).filter(c => c.type === 'credito');
    const totalCreditLimit = creditCards.reduce((acc, c) => acc + (Number(c.limit) || 0), 0);
    const totalCreditUsed = creditCards.reduce((acc, c) => acc + (Number(c.used) || 0), 0);

    // Cálculo del Score de Salud Financiera (0 - 100)
    let healthScore = 100;
    if (income > 0) {
      const fixedRate = (totalFixed / income) * 100;
      let maxFixedAllowed = 50;
      if (activeScheme === 'libertad_financiera') maxFixedAllowed = 70;
      else if (activeScheme === 'personalizado') maxFixedAllowed = customSettings.fixedPercent || 50;

      if (fixedRate > maxFixedAllowed) {
        healthScore -= Math.min(40, Math.round((fixedRate - maxFixedAllowed) * 1.5));
      }
      
      const debtRate = (totalInstallments / income) * 100;
      if (debtRate > 20) {
        healthScore -= Math.min(30, Math.round((debtRate - 20) * 1.2));
      }

      if (available < suggestedSavings) {
        healthScore -= 20;
      }
    } else {
      healthScore = 50;
    }
    healthScore = Math.max(10, Math.min(100, healthScore));

    // Renderizar KPIs
    renderKPIs({
      totalSavings,
      totalGoals,
      income,
      totalCommitted,
      available,
      freeDiscretionary,
      healthScore,
      totalCreditLimit,
      totalCreditUsed
    });

    // Renderizar Selector y Comparativa del Esquema Activo
    renderSchemeOverview(state, {
      income,
      totalFixed,
      totalInstallments,
      suggestedSavings,
      freeDiscretionary,
      activeScheme,
      customSettings
    });

    // Renderizar Gráfico Donut SVG interactivo
    renderBudgetDonutChart({
      income,
      totalFixed,
      totalInstallments,
      suggestedSavings,
      freeDiscretionary
    });

    // Renderizar Visión de Todas las Jarras Dinámicas
    renderDynamicJarsGrid(state, activeJars, income);

    // Renderizar Proyecciones F.I.R.E. y Fondo de Emergencia
    renderFinancialProjections(state, activeJars, income, suggestedSavings, customSettings);

    // Renderizar Calendario Financiero Mensual
    renderMonthlyCalendar(state);
  }

  function renderKPIs(data) {
    const { formatMoney } = FinanStore;

    const totalSavingsEl = document.getElementById('dash-kpi-total-savings');
    const healthScoreEl = document.getElementById('dash-kpi-health-score');
    const healthBadgeEl = document.getElementById('dash-kpi-health-badge');
    const availableEl = document.getElementById('dash-kpi-available');
    const debtEl = document.getElementById('dash-kpi-debt');

    if (totalSavingsEl) totalSavingsEl.textContent = formatMoney(data.totalSavings);
    
    if (healthScoreEl) {
      healthScoreEl.textContent = `${data.healthScore}/100`;
    }

    if (healthBadgeEl) {
      let label = 'Excelente';
      let colorClass = 'pill-success';
      if (data.healthScore < 50) {
        label = 'En Riesgo';
        colorClass = 'pill-danger';
      } else if (data.healthScore < 75) {
        label = 'Aceptable';
        colorClass = 'pill-warning';
      }
      healthBadgeEl.className = `pill-badge ${colorClass}`;
      healthBadgeEl.textContent = label;
    }

    if (availableEl) availableEl.textContent = formatMoney(data.available);
    if (debtEl) debtEl.textContent = formatMoney(data.totalCreditUsed);
  }

  function renderSchemeOverview(state, data) {
    const { formatMoney } = FinanStore;
    const { income, totalFixed, totalInstallments, suggestedSavings, freeDiscretionary, activeScheme, customSettings } = data;

    const schemeBadgeEl = document.getElementById('dash-active-scheme-badge');
    if (schemeBadgeEl) {
      if (activeScheme === 'libertad_financiera') schemeBadgeEl.textContent = '🌟 Libertad Financiera';
      else if (activeScheme === 'comun') schemeBadgeEl.textContent = '🔷 Esquema Común (50/30/20)';
      else schemeBadgeEl.textContent = '⚙️ Esquema Personalizado';
    }

    const btnOpenScheme = document.getElementById('btn-open-scheme-modal-dash');
    if (btnOpenScheme) {
      btnOpenScheme.onclick = () => {
        FinanApp.openModal('modal-change-scheme');
      };
    }

    const schemeTitleEl = document.getElementById('dash-scheme-title');
    const schemeSubtitleEl = document.getElementById('dash-scheme-subtitle');
    const schemeGuidelinesContainer = document.getElementById('dash-scheme-guidelines');

    if (activeScheme === 'libertad_financiera') {
      if (schemeTitleEl) schemeTitleEl.textContent = '🌟 Esquema Libertad Financiera (F.I.R.E.)';
      if (schemeSubtitleEl) {
        schemeSubtitleEl.textContent = 'Estrategia de optimización: 70% tope de fijos, 20% margen libre y 10% ahorro mensual.';
      }
    } else if (activeScheme === 'comun') {
      if (schemeTitleEl) schemeTitleEl.textContent = '🔷 Esquema Común (Regla 50 / 30 / 20)';
      if (schemeSubtitleEl) {
        schemeSubtitleEl.textContent = 'Estructura equilibrada clásica: 50% gastos fijos, 30% estilo de vida y 20% ahorro.';
      }
    } else {
      if (schemeTitleEl) schemeTitleEl.textContent = '⚙️ Esquema Personalizado';
      if (schemeSubtitleEl) {
        schemeSubtitleEl.textContent = `Reglas a tu medida: ${customSettings.fixedPercent}% fijos, ${customSettings.freePercent}% libres, ${customSettings.savingsPercent}% ahorro.`;
      }
    }

    // Porcentajes Reales
    const pFixed = income > 0 ? Number(((totalFixed / income) * 100).toFixed(1)) : 0;
    const pSav = income > 0 ? Number(((suggestedSavings / income) * 100).toFixed(1)) : 0;
    const pFree = income > 0 ? Number(((freeDiscretionary / income) * 100).toFixed(1)) : 0;

    if (schemeGuidelinesContainer) {
      if (activeScheme === 'libertad_financiera') {
        const fixedMax = 70;
        const isFixedOk = pFixed <= fixedMax;

        schemeGuidelinesContainer.innerHTML = `
          <div class="guideline-card ${isFixedOk ? 'status-ok' : 'status-alert'}">
            <div class="gl-header">
              <span>🏠 Máximo Gastos Fijos (sueldo base * 0.70)</span>
              <strong>${pFixed}% / 70% máx (${formatMoney(totalFixed)})</strong>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill ${isFixedOk ? 'fill-emerald' : 'fill-rose'}" style="width: ${Math.min(100, (pFixed / 70) * 100)}%;"></div>
            </div>
            <small class="gl-note">${isFixedOk ? '✓ Gastos fijos dentro del límite saludable del 70%' : '⚠️ Has superado el 70% máximo sugerido para costos fijos'}</small>
          </div>

          <div class="guideline-card">
            <div class="gl-header">
              <span>✨ Disponible para Ti / Gustos (sueldo base * 0.20)</span>
              <strong>Sugerido: ${formatMoney(income * 0.2)}/mes (20%)</strong>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill fill-cyan" style="width: ${Math.min(100, (pFree / 20) * 100)}%;"></div>
            </div>
            <small class="gl-note">Disfrute sin culpa: recreación, salidas y hobbies personales.</small>
          </div>

          <div class="guideline-card">
            <div class="gl-header">
              <span>💎 Ahorro Mensual (sueldo base * 0.10)</span>
              <strong>Sugerido: ${formatMoney(income * 0.1)}/mes (10%)</strong>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill fill-emerald" style="width: ${Math.min(100, (pSav / 10) * 100)}%;"></div>
            </div>
            <small class="gl-note">Aporte constante protegido mes a mes para nutrir tus proyectos e inversiones.</small>
          </div>
        `;
      } else if (activeScheme === 'comun') {
        const isFixedOk = pFixed <= 50;
        const isSavOk = pSav >= 20;

        schemeGuidelinesContainer.innerHTML = `
          <div class="guideline-card ${isFixedOk ? 'status-ok' : 'status-alert'}">
            <div class="gl-header">
              <span>🏠 Gastos Fijos (sueldo base * 0.50)</span>
              <strong>${pFixed}% / 50% (${formatMoney(totalFixed)})</strong>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill ${isFixedOk ? 'fill-emerald' : 'fill-rose'}" style="width: ${Math.min(100, (pFixed / 50) * 100)}%;"></div>
            </div>
            <small class="gl-note">${isFixedOk ? '✓ Cumples con la regla del 50% para costos básicos' : '⚠️ Los gastos fijos sobrepasan el 50% recomendado'}</small>
          </div>

          <div class="guideline-card">
            <div class="gl-header">
              <span>🏖️ Gustos o Variables (sueldo base * 0.30)</span>
              <strong>${pFree}% / 30% (${formatMoney(income * 0.3)})</strong>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill fill-cyan" style="width: ${Math.min(100, (pFree / 30) * 100)}%;"></div>
            </div>
            <small class="gl-note">Estilo de vida, salidas a comer, compras y ocio.</small>
          </div>

          <div class="guideline-card ${isSavOk ? 'status-ok' : 'status-alert'}">
            <div class="gl-header">
              <span>🪙 Ahorro e Inversión (sueldo base * 0.20)</span>
              <strong>${pSav}% / 20% (${formatMoney(income * 0.2)})</strong>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill ${isSavOk ? 'fill-emerald' : 'fill-amber'}" style="width: ${Math.min(100, (pSav / 20) * 100)}%;"></div>
            </div>
            <small class="gl-note">${isSavOk ? '✓ Gran hábito: cumples con el 20% de ahorro e inversión' : '⚡ Te sugerimos proteger al menos el 20% de tu sueldo'}</small>
          </div>
        `;
      } else {
        // Esquema Personalizado
        const fixedLimit = customSettings.fixedPercent || 50;
        const isFixedOk = pFixed <= fixedLimit;
        const targetSav = customSettings.savingsPercent || 20;
        const isSavOk = pSav >= targetSav;

        schemeGuidelinesContainer.innerHTML = `
          <div style="display: flex; justify-content: flex-end; margin-bottom: 0.25rem;">
            <button class="btn-xs btn-outline" id="btn-dash-edit-custom-scheme">⚙️ Configurar Porcentajes del Esquema</button>
          </div>

          <div class="guideline-card ${isFixedOk ? 'status-ok' : 'status-alert'}">
            <div class="gl-header">
              <span>🏠 Gastos Fijos (Objetivo: ${fixedLimit}%)</span>
              <strong>${pFixed}% / ${fixedLimit}% (${formatMoney(totalFixed)})</strong>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill ${isFixedOk ? 'fill-emerald' : 'fill-rose'}" style="width: ${Math.min(100, (pFixed / fixedLimit) * 100)}%;"></div>
            </div>
            <small class="gl-note">${isFixedOk ? '✓ Dentro de tu meta personalizada de costos fijos' : `⚠️ Supera tu objetivo fijado de ${fixedLimit}%`}</small>
          </div>

          <div class="guideline-card">
            <div class="gl-header">
              <span>✨ Margen Libre / Gustos (Objetivo: ${customSettings.freePercent || 30}%)</span>
              <strong>${pFree}% / ${customSettings.freePercent || 30}% (${formatMoney(income * ((customSettings.freePercent || 30) / 100))})</strong>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill fill-cyan" style="width: ${Math.min(100, (pFree / (customSettings.freePercent || 30)) * 100)}%;"></div>
            </div>
          </div>

          <div class="guideline-card ${isSavOk ? 'status-ok' : 'status-alert'}">
            <div class="gl-header">
              <span>💰 Ahorro e Inversión (Objetivo: ${targetSav}%)</span>
              <strong>${pSav}% / ${targetSav}% (${formatMoney(income * (targetSav / 100))})</strong>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill ${isSavOk ? 'fill-emerald' : 'fill-amber'}" style="width: ${Math.min(100, (pSav / targetSav) * 100)}%;"></div>
            </div>
          </div>
        `;

        document.getElementById('btn-dash-edit-custom-scheme')?.addEventListener('click', () => {
          FinanApp.openCustomSchemeModal();
        });
      }
    }
  }

  function renderBudgetDonutChart(data) {
    const { formatMoney } = FinanStore;
    const { income, totalFixed, totalInstallments, suggestedSavings, freeDiscretionary } = data;

    const donutSvg = document.getElementById('dash-donut-svg');
    const donutLegend = document.getElementById('dash-donut-legend');
    const donutCenterAmount = document.getElementById('dash-donut-center-amount');

    if (donutCenterAmount) {
      donutCenterAmount.textContent = formatMoney(income);
    }

    if (!donutSvg) return;

    if (income <= 0) {
      donutSvg.innerHTML = `
        <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="28"></circle>
      `;
      if (donutLegend) {
        donutLegend.innerHTML = `<div class="text-subtle" style="text-align:center;">Ingresa tus ingresos para ver el desglose gráfico.</div>`;
      }
      return;
    }

    const segments = [
      { name: 'Gastos Fijos', amount: totalFixed, color: '#F43F5E', emoji: '🏠' },
      { name: 'Cuotas y Deudas', amount: totalInstallments, color: '#F59E0B', emoji: '💳' },
      { name: 'Ahorro Protegido', amount: suggestedSavings, color: '#10B981', emoji: '🌱' },
      { name: 'Disponible Libre', amount: freeDiscretionary, color: '#06B6D4', emoji: '✨' }
    ];

    const total = income;
    const radius = 80;
    const circumference = 2 * Math.PI * radius; // ~502.65
    let cumulativePercent = 0;

    let svgPaths = '';

    segments.forEach(seg => {
      const pct = seg.amount / total;
      const strokeLength = Math.max(0, pct * circumference);
      const strokeDashoffset = -cumulativePercent * circumference;

      if (seg.amount > 0) {
        svgPaths += `
          <circle 
            cx="100" 
            cy="100" 
            r="${radius}" 
            fill="none" 
            stroke="${seg.color}" 
            stroke-width="26"
            stroke-dasharray="${strokeLength} ${circumference - strokeLength}"
            stroke-dashoffset="${strokeDashoffset}"
            transform="rotate(-90 100 100)"
            style="transition: all 0.5s ease;"
          ></circle>
        `;
      }
      cumulativePercent += pct;
    });

    donutSvg.innerHTML = svgPaths;

    if (donutLegend) {
      donutLegend.innerHTML = segments.map(seg => {
        const pct = Math.round((seg.amount / total) * 100);
        return `
          <div class="donut-legend-item">
            <div class="legend-indicator" style="background: ${seg.color};"></div>
            <div class="legend-text">
              <span>${seg.emoji} ${seg.name}</span>
              <strong>${formatMoney(seg.amount)} (${pct}%)</strong>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  function renderDynamicJarsGrid(state, jars, income) {
    const { formatMoney } = FinanStore;
    const container = document.getElementById('dash-jars-grid');
    if (!container) return;

    if (!jars || jars.length === 0) {
      container.innerHTML = `<div class="text-subtle">No hay jarras configuradas en este esquema.</div>`;
      return;
    }

    container.innerHTML = jars.map(jar => {
      const target = FinanStore.calculateJarTarget(jar, income);
      const balance = Number(jar.balance) || 0;
      const percent = target > 0 ? Math.min(100, Number(((balance / target) * 100).toFixed(1))) : 0;
      const isComplete = percent >= 100;

      return `
        <div class="dash-jar-card ${state.activeJarId === jar.id ? 'active-jar-card' : ''}" data-dash-jar-id="${jar.id}">
          <div class="dash-jar-top">
            <div class="dash-jar-icon">${jar.emoji || '🏺'}</div>
            <div class="dash-jar-titles">
              <h4>${escapeHtml(jar.name)}</h4>
              <span class="text-subtle" style="font-size: 0.75rem;">${escapeHtml(jar.description || '')}</span>
            </div>
            <span class="dash-jar-pill ${isComplete ? 'text-emerald' : ''}">${percent}%</span>
          </div>

          <div class="dash-jar-stats">
            <div>
              <span class="text-subtle" style="font-size: 0.75rem;">Saldo Actual</span>
              <div class="dash-jar-balance">${formatMoney(balance)}</div>
            </div>
            <div style="text-align: right;">
              <span class="text-subtle" style="font-size: 0.75rem;">Meta Objetivo</span>
              <div class="dash-jar-target">${formatMoney(target)}</div>
            </div>
          </div>

          <div class="progress-bar-bg" style="height: 9px;">
            <div class="progress-bar-fill ${isComplete ? 'fill-emerald' : 'fill-cyan'}" style="width: ${percent}%;"></div>
          </div>

          <div class="dash-jar-actions">
            <button class="btn-xs btn-outline" data-quick-deposit-jar="${jar.id}" data-amount="20000">+ $20k</button>
            <button class="btn-xs btn-outline" data-quick-deposit-jar="${jar.id}" data-amount="50000">+ $50k</button>
            <button class="btn-xs btn-primary" data-select-view-jar="${jar.id}">Ver Jarra 🌊</button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-quick-deposit-jar]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const jarId = btn.getAttribute('data-quick-deposit-jar');
        const amount = Number(btn.getAttribute('data-amount')) || 0;
        FinanStore.depositToJar(jarId, amount);
        FinanApp.showToast(`¡Abonaste ${formatMoney(amount)} a tu jarra!`, 'success');
      });
    });

    container.querySelectorAll('[data-select-view-jar]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const jarId = btn.getAttribute('data-select-view-jar');
        FinanStore.setActiveJar(jarId);
        FinanApp.switchTab('ahorros');
      });
    });
  }

  function renderFinancialProjections(state, jars, income, monthlySavings, customSettings) {
    const { formatMoney } = FinanStore;

    const emergJar = (jars || []).find(j => j.category === 'emergencia') || (jars && jars[0]);
    const freedomJar = (jars || []).find(j => j.category === 'inversion') || (jars && jars[1]);

    const emergContainer = document.getElementById('dash-projection-emergency');
    const freedomContainer = document.getElementById('dash-projection-freedom');

    if (emergContainer && emergJar) {
      const targetEmerg = FinanStore.calculateJarTarget(emergJar, income);
      const balanceEmerg = Number(emergJar.balance) || 0;
      const remainingEmerg = Math.max(0, targetEmerg - balanceEmerg);

      let monthsToEmerg = 0;
      if (remainingEmerg === 0) {
        monthsToEmerg = 0;
      } else if (monthlySavings > 0) {
        monthsToEmerg = Math.ceil(remainingEmerg / monthlySavings);
      } else {
        monthsToEmerg = '—';
      }

      emergContainer.innerHTML = `
        <div class="projection-badge">🛡️ Fondo de Emergencia</div>
        <div class="projection-target-title">${formatMoney(balanceEmerg)} de ${formatMoney(targetEmerg)}</div>
        <div class="projection-time">${remainingEmerg === 0 ? '¡Meta Completada! 🎉' : `Faltan ~${monthsToEmerg} meses`}</div>
        <p class="projection-desc">Al ritmo actual de ahorro de ${formatMoney(monthlySavings)}/mes.</p>
      `;
    }

    if (freedomContainer && freedomJar) {
      const targetFreedom = FinanStore.calculateJarTarget(freedomJar, income);
      const balanceFreedom = Number(freedomJar.balance) || 0;
      const remainingFreedom = Math.max(0, targetFreedom - balanceFreedom);

      let yearsToFreedom = 0;
      if (remainingFreedom === 0) {
        yearsToFreedom = 0;
      } else if (monthlySavings > 0) {
        const annualSavings = monthlySavings * 12;
        yearsToFreedom = (remainingFreedom / annualSavings).toFixed(1);
      } else {
        yearsToFreedom = '—';
      }

      freedomContainer.innerHTML = `
        <div class="projection-badge">🚀 Libertad / Meta Principal</div>
        <div class="projection-target-title">${formatMoney(balanceFreedom)} de ${formatMoney(targetFreedom)}</div>
        <div class="projection-time">${remainingFreedom === 0 ? '¡Meta Alcanzada! 🏆' : `~${yearsToFreedom} años`}</div>
        <p class="projection-desc">Para acumular los ${formatMoney(targetFreedom)} definidos en tu plan.</p>
      `;
    }
  }

  // --- Módulo Calendario Financiero Mensual ---
  function renderMonthlyCalendar(state) {
    const { formatMoney } = FinanStore;

    const monthTitleEl = document.getElementById('cal-month-title');
    const daysGridEl = document.getElementById('cal-days-grid');
    const eventsBoxEl = document.getElementById('cal-selected-day-events');
    const btnPrev = document.getElementById('btn-cal-prev');
    const btnNext = document.getElementById('btn-cal-next');

    if (!daysGridEl) return;

    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth(); // 0-indexed

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    if (monthTitleEl) {
      monthTitleEl.textContent = `${monthNames[month]} ${year}`;
    }

    // Configurar listeners de navegación
    if (btnPrev && !btnPrev.dataset.bound) {
      btnPrev.dataset.bound = 'true';
      btnPrev.addEventListener('click', () => {
        calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
        calSelectedDay = null;
        renderMonthlyCalendar(FinanStore.getState());
      });
    }

    if (btnNext && !btnNext.dataset.bound) {
      btnNext.dataset.bound = 'true';
      btnNext.addEventListener('click', () => {
        calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
        calSelectedDay = null;
        renderMonthlyCalendar(FinanStore.getState());
      });
    }

    // Días del mes
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Dom, 1 = Lun...
    const adjustedFirstDay = (firstDayIndex === 0 ? 6 : firstDayIndex - 1); // 0 = Lun, 6 = Dom
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const today = new Date();
    const isCurrentRealMonth = (today.getFullYear() === year && today.getMonth() === month);
    const realTodayDate = today.getDate();

    // Mapeo de eventos por día del mes
    const eventsByDay = {};
    for (let d = 1; d <= totalDaysInMonth; d++) {
      eventsByDay[d] = [];
    }

    // 1. Ingreso Mensual
    const income = Number(state.monthlyIncome) || 0;
    if (income > 0) {
      eventsByDay[1].push({
        type: 'income',
        icon: '💰',
        title: 'Inicio de Mes Financiero',
        desc: `Ingreso presupuestado: ${formatMoney(income)}`,
        badgeClass: 'pill-success'
      });
      const endDay = totalDaysInMonth >= 30 ? 30 : totalDaysInMonth;
      eventsByDay[endDay].push({
        type: 'income',
        icon: '💵',
        title: 'Depósito / Fin de Mes Estimado',
        desc: `Cierre de ciclo de ingresos: ${formatMoney(income)}`,
        badgeClass: 'pill-success'
      });
    }

    // 2. Vencimientos y Cierres de Tarjetas
    const currentMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    (state.cards || []).forEach(card => {
      const dueDay = Math.min(totalDaysInMonth, Math.max(1, Number(card.paymentDueDay) || 5));
      const isPaid = card.lastPaidMonth === currentMonthKey;
      
      eventsByDay[dueDay].push({
        type: 'card_due',
        icon: '💳',
        title: `Vencimiento ${card.alias}`,
        desc: isPaid ? '¡Tarjeta pagada para este mes! ✓' : `Pago pendiente: ${formatMoney(card.used)}`,
        isPaid,
        cardId: card.id,
        badgeClass: isPaid ? 'pill-success' : 'pill-danger'
      });

      if (card.billingDay) {
        const billingDay = Math.min(totalDaysInMonth, Math.max(1, Number(card.billingDay) || 15));
        if (billingDay !== dueDay) {
          eventsByDay[billingDay].push({
            type: 'card_billing',
            icon: '📑',
            title: `Cierre Facturación ${card.alias}`,
            desc: `Corte de compras del periodo`,
            badgeClass: 'pill-info'
          });
        }
      }
    });

    // 3. Cuotas Activas
    (state.installments || []).forEach(inst => {
      const instDay = 10;
      const total = inst.totalInstallments || inst.remainingMonths || 1;
      const current = inst.currentInstallment || 1;

      eventsByDay[instDay].push({
        type: 'installment',
        icon: '🛍️',
        title: `Cuota ${inst.name}`,
        desc: `Cuota ${current}/${total} · ${formatMoney(inst.monthlyAmount)}`,
        badgeClass: 'pill-warning'
      });
    });

    // Generar cuadrícula de celdas
    let gridHtml = '';

    // Días del mes anterior
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      const prevD = prevMonthDays - i;
      gridHtml += `<div class="cal-day-cell other-month"><span class="cal-day-num">${prevD}</span></div>`;
    }

    // Días del mes actual
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const isToday = isCurrentRealMonth && day === realTodayDate;
      const isSelected = calSelectedDay === day;
      const dayEvents = eventsByDay[day] || [];
      
      const hasDue = dayEvents.some(e => e.type === 'card_due' && !e.isPaid);
      const hasPaid = dayEvents.some(e => e.type === 'card_due' && e.isPaid);
      const hasIncome = dayEvents.some(e => e.type === 'income');
      const hasInstallment = dayEvents.some(e => e.type === 'installment');

      let cellClass = 'cal-day-cell current-month';
      if (isToday) cellClass += ' is-today';
      if (isSelected) cellClass += ' is-selected';
      if (hasDue) cellClass += ' has-due-alert';
      else if (hasPaid) cellClass += ' has-paid-alert';

      let dotsHtml = '';
      if (dayEvents.length > 0) {
        dotsHtml += '<div class="cal-day-dots">';
        if (hasDue) dotsHtml += '<span class="cal-dot cal-dot-rose" title="Vencimiento pendiente"></span>';
        if (hasPaid) dotsHtml += '<span class="cal-dot cal-dot-emerald" title="Pagado"></span>';
        if (hasIncome) dotsHtml += '<span class="cal-dot cal-dot-emerald" title="Ingreso"></span>';
        if (hasInstallment) dotsHtml += '<span class="cal-dot cal-dot-amber" title="Cuota"></span>';
        dotsHtml += '</div>';
      }

      gridHtml += `
        <div class="${cellClass}" data-cal-day="${day}">
          <span class="cal-day-num">${day}</span>
          ${dotsHtml}
        </div>
      `;
    }

    // Días del mes siguiente
    const totalCells = adjustedFirstDay + totalDaysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let nextD = 1; nextD <= remainingCells; nextD++) {
      gridHtml += `<div class="cal-day-cell other-month"><span class="cal-day-num">${nextD}</span></div>`;
    }

    daysGridEl.innerHTML = gridHtml;

    // Conectar clic en días
    daysGridEl.querySelectorAll('[data-cal-day]').forEach(cell => {
      cell.addEventListener('click', () => {
        const clickedDay = Number(cell.getAttribute('data-cal-day'));
        if (calSelectedDay === clickedDay) {
          calSelectedDay = null;
        } else {
          calSelectedDay = clickedDay;
        }
        renderMonthlyCalendar(state);
      });
    });

    // Renderizar Detalle de Eventos
    renderCalendarEventsList(eventsBoxEl, eventsByDay, totalDaysInMonth, calSelectedDay, monthNames[month], state);
  }

  function renderCalendarEventsList(container, eventsByDay, totalDays, selectedDay, monthName, state) {
    const { formatMoney } = FinanStore;
    if (!container) return;

    if (selectedDay) {
      const events = eventsByDay[selectedDay] || [];
      if (events.length === 0) {
        container.innerHTML = `
          <div class="cal-events-header">
            <strong>📅 Día ${selectedDay} de ${monthName}</strong>
            <button class="btn-xs btn-outline" id="btn-cal-show-all">Ver todo el mes</button>
          </div>
          <p class="text-subtle" style="font-size: 0.78rem; margin-top: 0.3rem;">No tienes vencimientos ni compromisos registrados en este día.</p>
        `;
      } else {
        container.innerHTML = `
          <div class="cal-events-header">
            <strong>📅 Compromisos del Día ${selectedDay} de ${monthName}:</strong>
            <button class="btn-xs btn-outline" id="btn-cal-show-all">Ver todo el mes</button>
          </div>
          <div class="cal-events-stack">
            ${events.map(ev => `
              <div class="cal-event-row">
                <div class="cal-event-left">
                  <span class="cal-ev-icon">${ev.icon}</span>
                  <div>
                    <strong>${escapeHtml(ev.title)}</strong>
                    <p class="text-subtle" style="font-size: 0.75rem;">${escapeHtml(ev.desc)}</p>
                  </div>
                </div>
                <span class="pill-badge ${ev.badgeClass}">${ev.isPaid ? 'Pagado' : 'Programado'}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      document.getElementById('btn-cal-show-all')?.addEventListener('click', () => {
        calSelectedDay = null;
        renderMonthlyCalendar(state);
      });
      return;
    }

    const allEvents = [];
    for (let d = 1; d <= totalDays; d++) {
      (eventsByDay[d] || []).forEach(ev => {
        allEvents.push({ day: d, ...ev });
      });
    }

    const totalDueMonth = (state.cards || []).filter(c => c.type === 'credito').reduce((acc, c) => acc + (Number(c.used) || 0), 0);
    const totalInstMonth = (state.installments || []).reduce((acc, i) => acc + (Number(i.monthlyAmount) || 0), 0);

    if (allEvents.length === 0) {
      container.innerHTML = `
        <div class="cal-events-header">
          <strong>📅 Resumen de ${monthName}</strong>
          <span class="pill-badge pill-info">Sin vencimientos</span>
        </div>
        <p class="text-subtle" style="font-size: 0.78rem; margin-top: 0.35rem;">Agrega tus tarjetas y compras en cuotas para ver tus alertas y fechas de pago en este calendario.</p>
      `;
      return;
    }

    container.innerHTML = `
      <div class="cal-events-header">
        <div>
          <strong>📋 Fechas Clave y Vencimientos de ${monthName}:</strong>
          <p class="text-subtle" style="font-size: 0.75rem;">Total mensual en tarjetas y cuotas: <strong class="text-amber">${formatMoney(totalDueMonth + totalInstMonth)}</strong></p>
        </div>
        <span class="pill-badge pill-info">${allEvents.length} eventos</span>
      </div>
      <div class="cal-events-stack">
        ${allEvents.slice(0, 5).map(ev => `
          <div class="cal-event-row">
            <div class="cal-event-left">
              <span class="cal-ev-day-badge">Día ${ev.day}</span>
              <span class="cal-ev-icon">${ev.icon}</span>
              <div>
                <strong>${escapeHtml(ev.title)}</strong>
                <p class="text-subtle" style="font-size: 0.74rem;">${escapeHtml(ev.desc)}</p>
              </div>
            </div>
            <span class="pill-badge ${ev.badgeClass}">${ev.isPaid ? 'Pagado' : 'Agendado'}</span>
          </div>
        `).join('')}
      </div>
      <small class="text-subtle" style="display:block; text-align: center; margin-top: 0.4rem; font-size: 0.72rem;">💡 Haz clic en cualquier día del calendario para ver el detalle específico.</small>
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    render
  };
})();
