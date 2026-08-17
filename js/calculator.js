/**
 * FINANSY — PURCHASE CALCULATOR & FRENCH AMORTIZATION ENGINE
 * Motor matemático de simulación de compras a plazos y evaluación de impacto en liquidez.
 * Soporta Modo Rápido (Quick Check) y Modo Integrado con amortización francesa, comisiones e impuestos.
 */

const FinanCalculator = (() => {

  // Current calculation state
  let calcState = {
    mode: 'quick', // 'quick' | 'integrated'
    quickIncome: 1000000,
    productName: 'Notebook Ultrabook 16GB',
    productPrice: 650000,
    selectedCardId: '',
    hasInterest: false,
    monthlyRate: 1.89,
    installments: 6,
    savingsGuardPercent: 20,
    fixedMaintenanceFee: 0,
    administrativeTax: 0,
    showCostsSection: false
  };

  function init() {
    bindEvents();
    recalculate();
  }

  function bindEvents() {
    // Mode switcher buttons
    const btnQuick = document.getElementById('btn-mode-quick');
    const btnIntegrated = document.getElementById('btn-mode-integrated');

    if (btnQuick && btnIntegrated) {
      btnQuick.addEventListener('click', () => {
        setMode('quick');
      });
      btnIntegrated.addEventListener('click', () => {
        setMode('integrated');
      });
    }

    // Quick income input
    const quickIncomeInput = document.getElementById('calc-quick-income');
    if (quickIncomeInput) {
      quickIncomeInput.addEventListener('input', (e) => {
        calcState.quickIncome = Math.max(0, Number(e.target.value) || 0);
        recalculate();
      });
    }

    const nameInput = document.getElementById('calc-product-name');
    const priceInput = document.getElementById('calc-product-price');
    const cardSelect = document.getElementById('calc-card-select');
    const radioNo = document.getElementById('radio-interest-no');
    const radioYes = document.getElementById('radio-interest-yes');
    const rateInput = document.getElementById('calc-interest-rate');
    const rateWrap = document.getElementById('calc-custom-rate-wrap');
    const instSlider = document.getElementById('calc-installments-slider');
    const instDisplay = document.getElementById('calc-installments-display');
    const guardSlider = document.getElementById('calc-savings-guard-slider');
    const guardBadge = document.getElementById('calc-savings-guard-percent');
    const btnCommit = document.getElementById('btn-save-as-commitment');
    const btnLoadSample = document.getElementById('btn-calc-load-sample');

    // Operational costs toggle & inputs
    const btnToggleCosts = document.getElementById('btn-toggle-operational-costs');
    const costsWrap = document.getElementById('operational-costs-fields-wrap');
    const chevronCosts = document.getElementById('costs-toggle-chevron');
    const maintFeeInput = document.getElementById('calc-maintenance-fee');
    const taxFeeInput = document.getElementById('calc-tax-fee');

    if (btnToggleCosts && costsWrap) {
      btnToggleCosts.addEventListener('click', () => {
        calcState.showCostsSection = !calcState.showCostsSection;
        costsWrap.style.display = calcState.showCostsSection ? 'block' : 'none';
        if (chevronCosts) {
          chevronCosts.textContent = calcState.showCostsSection ? '▲' : '▼';
        }
      });
    }

    if (maintFeeInput) {
      maintFeeInput.addEventListener('input', (e) => {
        calcState.fixedMaintenanceFee = Math.max(0, Number(e.target.value) || 0);
        recalculate();
      });
    }

    if (taxFeeInput) {
      taxFeeInput.addEventListener('input', (e) => {
        calcState.administrativeTax = Math.max(0, Number(e.target.value) || 0);
        recalculate();
      });
    }

    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        calcState.productName = e.target.value;
      });
    }

    if (priceInput) {
      priceInput.addEventListener('input', (e) => {
        calcState.productPrice = Math.max(0, Number(e.target.value) || 0);
        recalculate();
      });
    }

    if (cardSelect) {
      cardSelect.addEventListener('change', (e) => {
        calcState.selectedCardId = e.target.value;
        recalculate();
      });
    }

    if (radioNo && radioYes) {
      const handleInterestChange = () => {
        calcState.hasInterest = radioYes.checked;
        if (rateWrap) rateWrap.style.display = calcState.hasInterest ? 'block' : 'none';
        recalculate();
      };
      radioNo.addEventListener('change', handleInterestChange);
      radioYes.addEventListener('change', handleInterestChange);
    }

    if (rateInput) {
      rateInput.addEventListener('input', (e) => {
        calcState.monthlyRate = Math.max(0, Number(e.target.value) || 0);
        recalculate();
      });
    }

    if (instSlider) {
      instSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value) || 1;
        calcState.installments = val;
        if (instDisplay) instDisplay.textContent = `${val} ${val === 1 ? 'cuota' : 'cuotas'}`;
        updatePills(val);
        recalculate();
      });
    }

    // Quick installment pills
    document.querySelectorAll('.btn-pill-installment').forEach(pill => {
      pill.addEventListener('click', () => {
        if (pill.classList.contains('disabled')) return;
        const cuotas = Number(pill.getAttribute('data-cuotas')) || 1;
        calcState.installments = cuotas;
        if (instSlider) instSlider.value = cuotas;
        if (instDisplay) instDisplay.textContent = `${cuotas} ${cuotas === 1 ? 'cuota' : 'cuotas'}`;
        updatePills(cuotas);
        recalculate();
      });
    });

    if (guardSlider) {
      guardSlider.addEventListener('input', (e) => {
        const pct = Number(e.target.value) || 0;
        calcState.savingsGuardPercent = pct;
        if (guardBadge) guardBadge.textContent = `${pct}%`;
        recalculate();
      });
    }

    if (btnCommit) {
      btnCommit.addEventListener('click', commitPurchase);
    }

    if (btnLoadSample) {
      btnLoadSample.addEventListener('click', () => {
        FinanDemo.loadDemoSimulation();
      });
    }
  }

  function setMode(mode) {
    calcState.mode = mode;

    const btnQuick = document.getElementById('btn-mode-quick');
    const btnIntegrated = document.getElementById('btn-mode-integrated');
    const quickIncomeWrap = document.getElementById('calc-quick-income-wrap');
    const cardStepTitle = document.getElementById('calc-step-card-title');
    const cardSelectWrap = document.getElementById('calc-card-select-wrap');
    const cardPreview = document.getElementById('selected-card-preview');
    const cupoMetricWrap = document.getElementById('calc-cupo-metric-wrap');

    if (btnQuick) btnQuick.classList.toggle('active', mode === 'quick');
    if (btnIntegrated) btnIntegrated.classList.toggle('active', mode === 'integrated');

    if (quickIncomeWrap) {
      quickIncomeWrap.style.display = mode === 'quick' ? 'block' : 'none';
    }

    if (mode === 'quick') {
      if (cardStepTitle) cardStepTitle.style.display = 'none';
      if (cardSelectWrap) cardSelectWrap.style.display = 'none';
      if (cardPreview) cardPreview.style.display = 'none';
      if (cupoMetricWrap) cupoMetricWrap.style.display = 'none';
    } else {
      if (cardStepTitle) cardStepTitle.style.display = 'flex';
      if (cardSelectWrap) cardSelectWrap.style.display = 'block';
      if (cardPreview) cardPreview.style.display = 'flex';
      if (cupoMetricWrap) cupoMetricWrap.style.display = 'block';
    }

    recalculate();
  }

  function updatePills(activeCuotas) {
    document.querySelectorAll('.btn-pill-installment').forEach(pill => {
      const c = Number(pill.getAttribute('data-cuotas'));
      pill.classList.toggle('active', c === activeCuotas);
    });
  }

  function setValues(params) {
    if (params.mode !== undefined) setMode(params.mode);
    if (params.quickIncome !== undefined) calcState.quickIncome = params.quickIncome;
    if (params.productName !== undefined) calcState.productName = params.productName;
    if (params.productPrice !== undefined) calcState.productPrice = params.productPrice;
    if (params.selectedCardId !== undefined) calcState.selectedCardId = params.selectedCardId;
    if (params.hasInterest !== undefined) calcState.hasInterest = params.hasInterest;
    if (params.monthlyRate !== undefined) calcState.monthlyRate = params.monthlyRate;
    if (params.installments !== undefined) calcState.installments = params.installments;
    if (params.savingsGuardPercent !== undefined) calcState.savingsGuardPercent = params.savingsGuardPercent;
    if (params.fixedMaintenanceFee !== undefined) calcState.fixedMaintenanceFee = params.fixedMaintenanceFee;
    if (params.administrativeTax !== undefined) calcState.administrativeTax = params.administrativeTax;

    // Sync DOM inputs
    const quickIncomeInput = document.getElementById('calc-quick-income');
    const nameInput = document.getElementById('calc-product-name');
    const priceInput = document.getElementById('calc-product-price');
    const cardSelect = document.getElementById('calc-card-select');
    const radioNo = document.getElementById('radio-interest-no');
    const radioYes = document.getElementById('radio-interest-yes');
    const rateInput = document.getElementById('calc-interest-rate');
    const rateWrap = document.getElementById('calc-custom-rate-wrap');
    const instSlider = document.getElementById('calc-installments-slider');
    const instDisplay = document.getElementById('calc-installments-display');
    const guardSlider = document.getElementById('calc-savings-guard-slider');
    const guardBadge = document.getElementById('calc-savings-guard-percent');
    const maintFeeInput = document.getElementById('calc-maintenance-fee');
    const taxFeeInput = document.getElementById('calc-tax-fee');

    if (quickIncomeInput) quickIncomeInput.value = calcState.quickIncome;
    if (nameInput) nameInput.value = calcState.productName;
    if (priceInput) priceInput.value = calcState.productPrice;
    if (cardSelect && calcState.selectedCardId) cardSelect.value = calcState.selectedCardId;
    if (maintFeeInput) maintFeeInput.value = calcState.fixedMaintenanceFee;
    if (taxFeeInput) taxFeeInput.value = calcState.administrativeTax;

    if (radioNo && radioYes) {
      radioNo.checked = !calcState.hasInterest;
      radioYes.checked = calcState.hasInterest;
      if (rateWrap) rateWrap.style.display = calcState.hasInterest ? 'block' : 'none';
    }

    if (rateInput) rateInput.value = calcState.monthlyRate;
    if (instSlider) instSlider.value = calcState.installments;
    if (instDisplay) instDisplay.textContent = `${calcState.installments} ${calcState.installments === 1 ? 'cuota' : 'cuotas'}`;
    if (guardSlider) guardSlider.value = calcState.savingsGuardPercent;
    if (guardBadge) guardBadge.textContent = `${calcState.savingsGuardPercent}%`;

    updatePills(calcState.installments);
    recalculate();
  }

  function recalculate() {
    const { formatMoney } = FinanStore;
    const globalState = FinanStore.getState();
    const isQuickMode = calcState.mode === 'quick';

    // 1. Determine Effective Income Base
    const effectiveIncome = isQuickMode 
      ? (calcState.quickIncome || 0) 
      : (globalState.monthlyIncome || 0);

    // 2. Card Handling (Only applies in Integrated Mode)
    let selectedCard = null;
    let isDebit = false;
    let cardAvail = 0;
    let cardLimit = 0;
    let isExceedingCupo = false;
    let cupoUsagePercentAfter = 0;

    if (!isQuickMode) {
      const cardSelect = document.getElementById('calc-card-select');
      let cardId = (cardSelect && cardSelect.value) ? cardSelect.value : (globalState.cards[0] ? globalState.cards[0].id : null);
      selectedCard = globalState.cards.find(c => c.id === cardId) || null;
      isDebit = selectedCard && selectedCard.type === 'debito';

      if (selectedCard && !isDebit) {
        cardAvail = Math.max(0, selectedCard.limit - selectedCard.used);
        cardLimit = selectedCard.limit;
        isExceedingCupo = calcState.productPrice > cardAvail;
        cupoUsagePercentAfter = cardLimit > 0 ? Math.min(100, Math.round(((selectedCard.used + calcState.productPrice) / cardLimit) * 100)) : 0;
      }

      updateCardPreview(selectedCard);
    }

    // Debit forces cash purchase
    const radioNo = document.getElementById('radio-interest-no');
    const radioYes = document.getElementById('radio-interest-yes');
    const rateWrap = document.getElementById('calc-custom-rate-wrap');
    const instSlider = document.getElementById('calc-installments-slider');
    const instDisplay = document.getElementById('calc-installments-display');

    if (isDebit) {
      calcState.hasInterest = false;
      calcState.installments = 1;
      if (radioNo) { radioNo.checked = true; radioNo.disabled = true; }
      if (radioYes) { radioYes.checked = false; radioYes.disabled = true; }
      if (rateWrap) rateWrap.style.display = 'none';
      if (instSlider) { instSlider.value = 1; instSlider.disabled = true; }
      if (instDisplay) instDisplay.textContent = '1 cuota (Contado)';
      updatePills(1);
    } else {
      if (radioNo) radioNo.disabled = false;
      if (radioYes) radioYes.disabled = false;
      if (instSlider) instSlider.disabled = false;
    }

    const price = Math.max(0, calcState.productPrice);
    const n = isDebit ? 1 : Math.max(1, calcState.installments);
    const hasInt = isDebit ? false : calcState.hasInterest;
    const monthlyRateDec = (calcState.monthlyRate || 0) / 100;
    const maintFee = Number(calcState.fixedMaintenanceFee) || 0;
    const taxFee = Number(calcState.administrativeTax) || 0;

    // 3. French Amortization Engine Formula:
    // Cuota Base = M * [ i*(1+i)^n / ((1+i)^n - 1) ]
    let baseInstallment = 0;
    let totalInterest = 0;

    if (n === 1 || price === 0) {
      baseInstallment = price;
      totalInterest = 0;
    } else if (!hasInt || monthlyRateDec <= 0) {
      baseInstallment = Math.round(price / n);
      totalInterest = 0;
    } else {
      const factor = Math.pow(1 + monthlyRateDec, n);
      baseInstallment = Math.round(price * (monthlyRateDec * factor) / (factor - 1));
      totalInterest = Math.max(0, (baseInstallment * n) - price);
    }

    // Add Operational Costs & Taxes
    const monthlyTax = Math.round(taxFee / n);
    const realMonthlyInstallment = baseInstallment + maintFee + monthlyTax;
    const totalOperationalCosts = (maintFee * n) + taxFee;
    const finalTotalCost = (baseInstallment * n) + totalOperationalCosts;

    // 4. Protected Margin & Quantitative Ratios
    const protectedSavingsAmount = Math.round(effectiveIncome * (calcState.savingsGuardPercent / 100));
    
    // Fixed expenses and existing installments in integrated mode
    const totalFixed = isQuickMode ? 0 : globalState.fixedExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const currentInstallments = isQuickMode ? 0 : globalState.installments.reduce((acc, i) => acc + (Number(i.monthlyAmount) || 0), 0);
    
    // Previous free margin before this purchase
    const baseDiscretionary = Math.max(0, effectiveIncome - totalFixed - currentInstallments - protectedSavingsAmount);
    const remainingFreeAfterPayment = baseDiscretionary - realMonthlyInstallment;

    // Metric 1: DTI (Debt-to-Income / Carga Financiera Post-Compra)
    const postCommitted = totalFixed + currentInstallments + realMonthlyInstallment;
    const dtiPost = effectiveIncome > 0 ? Math.round((postCommitted / effectiveIncome) * 100) : 0;

    // Metric 2: Unitary Impact Ratio on Income (Used in Quick Check)
    const unitaryIncomeRatio = effectiveIncome > 0 ? Math.round((realMonthlyInstallment / effectiveIncome) * 100) : 0;

    // Metric 3: Free Margin Consumption
    const marginConsumptionRatio = baseDiscretionary > 0 
      ? Math.round((realMonthlyInstallment / baseDiscretionary) * 100) 
      : 100;

    // 5. Update UI Outputs
    const heroPriceEl = document.getElementById('calc-monthly-installment-display');
    const heroPeriodEl = document.getElementById('calc-period-subtitle');
    const origPriceEl = document.getElementById('calc-original-price-display');
    const totalIntEl = document.getElementById('calc-total-interest-display');
    const operRowEl = document.getElementById('calc-operational-costs-row');
    const operValEl = document.getElementById('calc-total-operational-display');
    const finalTotalEl = document.getElementById('calc-final-total-display');
    const guardAmountEl = document.getElementById('calc-savings-guard-amount');
    const baseIncomeEl = document.getElementById('calc-base-income-display');

    if (heroPriceEl) heroPriceEl.textContent = formatMoney(realMonthlyInstallment);
    if (heroPeriodEl) {
      heroPeriodEl.textContent = isDebit 
        ? 'Pago total al contado (Débito)' 
        : `por ${n} ${n === 1 ? 'mes' : 'meses consecutivos'}`;
    }
    if (origPriceEl) origPriceEl.textContent = formatMoney(price);
    
    if (totalIntEl) {
      if (isDebit) {
        totalIntEl.textContent = '$0 (Débito al Contado)';
        totalIntEl.className = 'text-emerald';
      } else {
        totalIntEl.textContent = hasInt 
          ? `${formatMoney(totalInterest)} (${calcState.monthlyRate}% mensual francés)` 
          : '$0 (Sin Interés)';
        totalIntEl.className = hasInt ? 'text-rose' : 'text-emerald';
      }
    }

    if (operRowEl && operValEl) {
      if (totalOperationalCosts > 0) {
        operRowEl.style.display = 'flex';
        operValEl.textContent = `${formatMoney(totalOperationalCosts)} (${formatMoney(maintFee)}/mes + ${formatMoney(taxFee)} imp.)`;
      } else {
        operRowEl.style.display = 'none';
      }
    }

    if (finalTotalEl) finalTotalEl.textContent = formatMoney(finalTotalCost);
    if (guardAmountEl) guardAmountEl.textContent = formatMoney(protectedSavingsAmount);
    if (baseIncomeEl) baseIncomeEl.textContent = formatMoney(effectiveIncome);

    // Impact Metric Bar & Labels
    const impactLabelEl = document.getElementById('calc-impact-ratio-label');
    const impactValEl = document.getElementById('calc-impact-ratio-value');
    const impactBarEl = document.getElementById('calc-impact-ratio-bar');
    const cupoTextEl = document.getElementById('calc-card-cupo-usage-text');
    const cupoBarEl = document.getElementById('calc-card-cupo-bar');

    if (impactLabelEl && impactValEl && impactBarEl) {
      if (isQuickMode) {
        impactLabelEl.textContent = 'Impacto de la Cuota sobre tu Ingreso Estimado:';
        impactValEl.textContent = `${unitaryIncomeRatio}%`;
        impactBarEl.style.width = `${Math.min(100, unitaryIncomeRatio)}%`;
        impactBarEl.className = `progress-bar-fill ${unitaryIncomeRatio > 20 ? 'fill-rose' : (unitaryIncomeRatio > 10 ? 'fill-amber' : 'fill-emerald')}`;
      } else {
        impactLabelEl.textContent = 'Carga Financiera Total Post-Compra (DTI):';
        impactValEl.textContent = `${dtiPost}% del sueldo`;
        impactBarEl.style.width = `${Math.min(100, dtiPost)}%`;
        impactBarEl.className = `progress-bar-fill ${dtiPost > 50 ? 'fill-rose' : (dtiPost > 35 ? 'fill-amber' : 'fill-emerald')}`;
      }
    }

    if (cupoTextEl && !isQuickMode) {
      if (isDebit) {
        cupoTextEl.textContent = '💵 Tarjeta de Débito: Sin cupo mensual de crédito';
      } else {
        cupoTextEl.textContent = selectedCard 
          ? `${cupoUsagePercentAfter}% proyectado (Disp: ${formatMoney(Math.max(0, cardAvail - price))})`
          : '⚠️ Requiere registrar tarjeta';
      }
    }

    if (cupoBarEl && !isQuickMode) {
      cupoBarEl.style.width = isDebit ? '0%' : `${cupoUsagePercentAfter}%`;
      cupoBarEl.className = `progress-bar-fill ${cupoUsagePercentAfter > 85 ? 'fill-rose' : (cupoUsagePercentAfter > 60 ? 'fill-amber' : 'fill-emerald')}`;
    }

    // 6. Strict Mathematical Verdict Evaluation
    updateVerdict({
      isQuickMode,
      hasCard: isQuickMode || !!selectedCard,
      isDebit,
      price,
      realMonthlyInstallment,
      remainingFreeAfterPayment,
      isExceedingCupo,
      cardAvail,
      savingsGuardPercent: calcState.savingsGuardPercent,
      protectedSavingsAmount,
      dtiPost,
      unitaryIncomeRatio,
      marginConsumptionRatio,
      n
    });
  }

  function updateCardPreview(card) {
    const previewBox = document.getElementById('selected-card-preview');
    if (!previewBox) return;

    if (!card) {
      previewBox.innerHTML = `
        <div class="no-card-alert-content">
          <div class="no-card-icon">💳</div>
          <div class="no-card-texts">
            <strong>Debes ingresar al menos 1 tarjeta para el Modo Integrado</strong>
            <p class="text-subtle" style="font-size: 0.8rem; margin-top: 0.15rem;">O usa el Modo Rápido (Quick Check) en el selector superior para evaluar al instante sin configuración previa.</p>
          </div>
          <button type="button" class="btn-xs btn-primary" id="btn-quick-add-card-calc" style="white-space: nowrap;">
            + Registrar Tarjeta
          </button>
        </div>
      `;
      document.getElementById('btn-quick-add-card-calc')?.addEventListener('click', () => {
        FinanApp.openModal('modal-card');
      });
      return;
    }

    const isDebit = card.type === 'debito';

    if (isDebit) {
      previewBox.innerHTML = `
        <div class="preview-card-chip"></div>
        <div class="preview-card-info">
          <strong id="preview-card-name">${escapeHtml(card.alias)}</strong>
          <span class="preview-card-type" id="preview-card-type">Débito Bancario · Pago al Contado</span>
        </div>
        <div class="preview-card-balance">
          <span style="color: #6EE7B7; font-size: 0.85rem; font-weight: 600;">✓ Pago directo al contado (1 cuota sin interés)</span>
        </div>
      `;
      return;
    }

    const avail = Math.max(0, card.limit - card.used);
    const typeText = card.type === 'credito' ? 'Crédito' : 'Prepago Digital';

    previewBox.innerHTML = `
      <div class="preview-card-chip"></div>
      <div class="preview-card-info">
        <strong id="preview-card-name">${escapeHtml(card.alias)}</strong>
        <span class="preview-card-type" id="preview-card-type">${typeText} · Corte día ${card.billingDay || 15}</span>
      </div>
      <div class="preview-card-balance">
        <span>Cupo disponible:</span>
        <strong id="preview-card-avail">${FinanStore.formatMoney(avail)}</strong>
      </div>
    `;
  }

  function updateVerdict(data) {
    const { formatMoney } = FinanStore;
    const badge = document.getElementById('calc-status-badge');
    const badgeText = document.getElementById('calc-status-text');
    const callout = document.getElementById('calc-diagnosis-callout');
    const calloutIcon = document.getElementById('calc-diagnosis-icon');
    const calloutTitle = document.getElementById('calc-diagnosis-title');
    const calloutDesc = document.getElementById('calc-diagnosis-desc');
    const btnCommit = document.getElementById('btn-save-as-commitment');

    if (!badge || !callout) return;

    // Reset classes
    badge.className = 'status-indicator-badge';
    callout.className = 'diagnosis-callout';

    // CASO 1: MODO RÁPIDO (QUICK CHECK)
    if (data.isQuickMode) {
      if (data.unitaryIncomeRatio <= 10) {
        // GREEN LIGHT
        badge.classList.add('status-safe');
        badgeText.textContent = '🟢 Compra Altamente Viable';
        callout.classList.add('safe');
        calloutIcon.textContent = '✅';
        calloutTitle.textContent = '¡Excelente Viabilidad Financiera!';
        calloutDesc.textContent = `La cuota de ${formatMoney(data.realMonthlyInstallment)} representa solo el ${data.unitaryIncomeRatio}% de tu ingreso estimado (zona óptima ≤ 10%). No compromete tu margen libre.`;
      } else if (data.unitaryIncomeRatio <= 20) {
        // YELLOW LIGHT
        badge.classList.add('status-warning');
        badgeText.textContent = '🟡 Carga Moderada (Precaución)';
        callout.classList.add('warning');
        calloutIcon.textContent = '⚠️';
        calloutTitle.textContent = 'Carga Mensual Moderada';
        calloutDesc.textContent = `La cuota absorbe el ${data.unitaryIncomeRatio}% de tu ingreso mensual estimado (rango de atención 10%-20%). Es viable, pero reducirá tu holgura para gastos imprevistos.`;
      } else {
        // RED LIGHT
        badge.classList.add('status-danger');
        badgeText.textContent = '🔴 Alto Riesgo de Carga';
        callout.classList.add('danger');
        calloutIcon.textContent = '🚨';
        calloutTitle.textContent = 'Alerta: Carga Individual Excesiva';
        calloutDesc.textContent = `Esta cuota compromete el ${data.unitaryIncomeRatio}% de tu ingreso mensual (umbral de alerta > 20% para una sola compra). Se recomienda aumentar el plazo de cuotas o ahorrar antes de comprar.`;
      }

      if (btnCommit) {
        btnCommit.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Guardar Simulación en mis Cuotas</span>
        `;
      }
      return;
    }

    // CASO 2: MODO INTEGRADO
    if (!data.hasCard) {
      badge.classList.add('status-warning');
      badgeText.textContent = 'Tarjeta Requerida';
      callout.classList.add('warning');
      calloutIcon.textContent = '💳';
      calloutTitle.textContent = 'Debes ingresar al menos 1 tarjeta para el Modo Integrado';
      calloutDesc.textContent = 'Para cruzar la compra con tu cupo real y deudas activas necesitas registrar una tarjeta, o cambia al Modo Rápido arriba para evaluar al instante.';
      if (btnCommit) {
        btnCommit.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span>+ Registrar Tarjeta</span>
        `;
      }
      return;
    }

    if (data.isExceedingCupo) {
      badge.classList.add('status-danger');
      badgeText.textContent = '🚫 Cupo Insuficiente';
      callout.classList.add('danger');
      calloutIcon.textContent = '🚫';
      calloutTitle.textContent = 'La compra excede el cupo disponible';
      calloutDesc.textContent = `Esta compra de ${formatMoney(data.price)} supera tu cupo disponible en esta tarjeta (${formatMoney(data.cardAvail)}). Considera abonar parte al contado o elegir otra tarjeta.`;
      return;
    }

    if (data.dtiPost > 50 || data.remainingFreeAfterPayment < 0 || data.marginConsumptionRatio > 85) {
      // RED LIGHT (ALTO RIESGO / DTI > 50% / DÉFICIT EN MARGEN INTOCABLE)
      badge.classList.add('status-danger');
      badgeText.textContent = '🔴 Alto Riesgo de Sobreendeudamiento';
      callout.classList.add('danger');
      calloutIcon.textContent = '🚨';
      calloutTitle.textContent = `Alerta: Compromete tu Salud Financiera (DTI ${data.dtiPost}%)`;
      calloutDesc.textContent = data.remainingFreeAfterPayment < 0
        ? `La cuota mensual de ${formatMoney(data.realMonthlyInstallment)} invade tu margen de reserva intocable (${data.savingsGuardPercent}% = ${formatMoney(data.protectedSavingsAmount)}), dejándote un déficit de ${formatMoney(Math.abs(data.remainingFreeAfterPayment))}.`
        : `Tu carga financiera total post-compra sube al ${data.dtiPost}% de tu sueldo (umbral de peligro > 50%) y consume el ${data.marginConsumptionRatio}% de tu margen libre disponible.`;
    } else if (data.dtiPost > 35 || data.marginConsumptionRatio > 50) {
      // YELLOW LIGHT (PRECAUCIÓN / DTI 35%-50% / CONSUMO MARGEN 50%-85%)
      badge.classList.add('status-warning');
      badgeText.textContent = '🟡 Precaución / Requiere Ajuste';
      callout.classList.add('warning');
      calloutIcon.textContent = '⚠️';
      calloutTitle.textContent = `Carga Moderada: DTI sube a ${data.dtiPost}%`;
      calloutDesc.textContent = `La cuota mensual de ${formatMoney(data.realMonthlyInstallment)} es viable pero eleva tu endeudamiento a zona amarilla (35%-50%) y consume el ${data.marginConsumptionRatio}% de tu margen disponible.`;
    } else {
      // GREEN LIGHT (DTI <= 35% & CONSUMO MARGEN <= 50%)
      badge.classList.add('status-safe');
      badgeText.textContent = data.isDebit ? '🟢 ¡Pago al Contado Listo!' : '🟢 ¡Compra Recomendada y Segura!';
      callout.classList.add('safe');
      calloutIcon.textContent = '✅';
      calloutTitle.textContent = data.isDebit ? 'Pago al Contado con Débito' : '¡Excelente Salud y Capacidad Financiera!';
      calloutDesc.textContent = data.isDebit
        ? `El pago al contado de ${formatMoney(data.price)} encaja dentro de tu presupuesto mensual y preserva tu margen intocable.`
        : `La cuota mensual de ${formatMoney(data.realMonthlyInstallment)} mantiene tu carga financiera en un óptimo ${data.dtiPost}% (≤ 35%) y conservas el ${100 - data.marginConsumptionRatio}% de tu margen libre para imprevistos.`;
    }

    if (btnCommit) {
      btnCommit.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>${data.isDebit ? 'Registrar Pago al Contado (Débito)' : 'Añadir a mis Cuotas Activas'}</span>
      `;
    }
  }

  function commitPurchase() {
    const { formatMoney } = FinanStore;
    const globalState = FinanStore.getState();
    const isQuickMode = calcState.mode === 'quick';
    const cardSelect = document.getElementById('calc-card-select');
    const cardId = cardSelect ? cardSelect.value : null;

    if (!calcState.productPrice || calcState.productPrice <= 0) {
      FinanApp.showToast('Ingresa un valor válido para la compra', 'info');
      return;
    }

    // In integrated mode, card is mandatory
    if (!isQuickMode && (!globalState.cards || globalState.cards.length === 0 || !cardId)) {
      FinanApp.showToast('Debes ingresar al menos 1 tarjeta para registrar la compra en Modo Integrado.', 'danger');
      FinanApp.openModal('modal-card');
      return;
    }

    const card = (!isQuickMode && cardId) ? globalState.cards.find(c => c.id === cardId) : null;
    const isDebit = card && card.type === 'debito';

    const n = isDebit ? 1 : Math.max(1, calcState.installments);
    const monthlyRateDec = (calcState.monthlyRate || 0) / 100;
    const maintFee = Number(calcState.fixedMaintenanceFee) || 0;
    const taxFee = Number(calcState.administrativeTax) || 0;

    let baseInstallment = Math.round(calcState.productPrice / n);
    if (!isDebit && calcState.hasInterest && monthlyRateDec > 0 && n > 1) {
      const factor = Math.pow(1 + monthlyRateDec, n);
      baseInstallment = Math.round(calcState.productPrice * (monthlyRateDec * factor) / (factor - 1));
    }

    const realMonthlyInstallment = baseInstallment + maintFee + Math.round(taxFee / n);

    FinanStore.addInstallment({
      name: calcState.productName || (isDebit ? 'Compra al contado' : 'Compra en cuotas'),
      monthlyAmount: realMonthlyInstallment,
      totalInstallments: n,
      currentInstallment: 1,
      remainingMonths: n,
      cardId: cardId || (globalState.cards[0] ? globalState.cards[0].id : null),
      totalPurchase: calcState.productPrice
    });

    FinanApp.showToast(`¡Compromiso de ${formatMoney(realMonthlyInstallment)}/mes añadido a tus compromisos!`, 'success');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    init,
    recalculate,
    setValues,
    setMode
  };
})();
