/**
 * FINANSY — PURCHASE CALCULATOR & SAVINGS PRESERVATION ENGINE
 * Motor inteligente de cálculo de compras en cuotas con soporte adaptativo para crédito y débito.
 */

const FinanCalculator = (() => {

  // Current internal calculation state
  let calcState = {
    productName: 'Notebook Ultrabook 16GB',
    productPrice: 650000,
    selectedCardId: '',
    hasInterest: false,
    monthlyRate: 1.89,
    installments: 6,
    savingsGuardPercent: 20
  };

  function init() {
    bindEvents();
    recalculate();
  }

  function bindEvents() {
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

  function updatePills(activeCuotas) {
    document.querySelectorAll('.btn-pill-installment').forEach(pill => {
      const c = Number(pill.getAttribute('data-cuotas'));
      pill.classList.toggle('active', c === activeCuotas);
    });
  }

  function setValues(params) {
    if (params.productName !== undefined) calcState.productName = params.productName;
    if (params.productPrice !== undefined) calcState.productPrice = params.productPrice;
    if (params.selectedCardId !== undefined) calcState.selectedCardId = params.selectedCardId;
    if (params.hasInterest !== undefined) calcState.hasInterest = params.hasInterest;
    if (params.monthlyRate !== undefined) calcState.monthlyRate = params.monthlyRate;
    if (params.installments !== undefined) calcState.installments = params.installments;
    if (params.savingsGuardPercent !== undefined) calcState.savingsGuardPercent = params.savingsGuardPercent;

    // Sync DOM inputs
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

    if (nameInput) nameInput.value = calcState.productName;
    if (priceInput) priceInput.value = calcState.productPrice;
    if (cardSelect && calcState.selectedCardId) cardSelect.value = calcState.selectedCardId;
    
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

    // Selected Card Check
    const cardSelect = document.getElementById('calc-card-select');
    let cardId = (cardSelect && cardSelect.value) ? cardSelect.value : (globalState.cards[0] ? globalState.cards[0].id : null);
    const selectedCard = globalState.cards.find(c => c.id === cardId) || null;
    const isDebit = selectedCard && selectedCard.type === 'debito';

    // Manejo de Débito (Contado obligatorio y sin interés)
    const radioNo = document.getElementById('radio-interest-no');
    const radioYes = document.getElementById('radio-interest-yes');
    const rateWrap = document.getElementById('calc-custom-rate-wrap');
    const instSlider = document.getElementById('calc-installments-slider');
    const instDisplay = document.getElementById('calc-installments-display');
    const interestOptionWrap = document.querySelector('.interest-mode-grid');

    if (isDebit) {
      calcState.hasInterest = false;
      calcState.installments = 1;
      if (radioNo) {
        radioNo.checked = true;
        radioNo.disabled = true;
      }
      if (radioYes) {
        radioYes.checked = false;
        radioYes.disabled = true;
      }
      if (rateWrap) rateWrap.style.display = 'none';
      if (instSlider) {
        instSlider.value = 1;
        instSlider.disabled = true;
      }
      if (instDisplay) instDisplay.textContent = '1 cuota (Contado)';

      document.querySelectorAll('.btn-pill-installment').forEach(pill => {
        const c = Number(pill.getAttribute('data-cuotas'));
        if (c > 1) {
          pill.classList.add('disabled');
          pill.style.opacity = '0.4';
          pill.style.pointerEvents = 'none';
        } else {
          pill.classList.remove('disabled');
          pill.style.opacity = '1';
          pill.style.pointerEvents = 'auto';
        }
      });
      updatePills(1);
    } else {
      if (radioNo) radioNo.disabled = false;
      if (radioYes) radioYes.disabled = false;
      if (instSlider) instSlider.disabled = false;
      document.querySelectorAll('.btn-pill-installment').forEach(pill => {
        pill.classList.remove('disabled');
        pill.style.opacity = '1';
        pill.style.pointerEvents = 'auto';
      });
    }

    // Update Selected Card Preview
    updateCardPreview(selectedCard);

    const price = Math.max(0, calcState.productPrice);
    const n = isDebit ? 1 : Math.max(1, calcState.installments);
    const hasInt = isDebit ? false : calcState.hasInterest;
    const monthlyRateDec = (calcState.monthlyRate || 0) / 100;
    const income = globalState.monthlyIncome || 0;
    const totalFixed = globalState.fixedExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const currentInstallments = globalState.installments.reduce((acc, i) => acc + (Number(i.monthlyAmount) || 0), 0);

    // 1. Calculate Monthly Installment & Total Cost
    let monthlyInstallment = 0;
    let totalCost = 0;
    let totalInterest = 0;

    if (n === 1 || price === 0) {
      monthlyInstallment = price;
      totalCost = price;
      totalInterest = 0;
    } else if (!hasInt) {
      monthlyInstallment = Math.round(price / n);
      totalCost = price;
      totalInterest = 0;
    } else {
      if (monthlyRateDec > 0) {
        const factor = Math.pow(1 + monthlyRateDec, n);
        monthlyInstallment = Math.round(price * (monthlyRateDec * factor) / (factor - 1));
        totalCost = monthlyInstallment * n;
        totalInterest = Math.max(0, totalCost - price);
      } else {
        monthlyInstallment = Math.round(price / n);
        totalCost = price;
        totalInterest = 0;
      }
    }

    // 2. Calculate Protected Savings & Budget Capacity
    const protectedSavingsAmount = Math.round(income * (calcState.savingsGuardPercent / 100));
    const baseDiscretionary = Math.max(0, income - totalFixed - currentInstallments - protectedSavingsAmount);
    const remainingFreeAfterPayment = baseDiscretionary - monthlyInstallment;

    // 3. Card Cupo Impact (Solo para crédito)
    const cardAvail = (!isDebit && selectedCard) ? Math.max(0, selectedCard.limit - selectedCard.used) : 0;
    const cardLimit = (!isDebit && selectedCard) ? selectedCard.limit : 0;
    const isExceedingCupo = (!isDebit && selectedCard) && (price > cardAvail);
    const cupoUsagePercentAfter = cardLimit > 0 ? Math.min(100, Math.round(((selectedCard.used + price) / cardLimit) * 100)) : 0;

    // 4. Update UI Outputs
    const heroPriceEl = document.getElementById('calc-monthly-installment-display');
    const heroPeriodEl = document.getElementById('calc-period-subtitle');
    const origPriceEl = document.getElementById('calc-original-price-display');
    const totalIntEl = document.getElementById('calc-total-interest-display');
    const finalTotalEl = document.getElementById('calc-final-total-display');
    const guardAmountEl = document.getElementById('calc-savings-guard-amount');
    const baseIncomeEl = document.getElementById('calc-base-income-display');

    if (heroPriceEl) heroPriceEl.textContent = formatMoney(monthlyInstallment);
    if (heroPeriodEl) {
      heroPeriodEl.textContent = isDebit ? 'Pago total al contado (Débito)' : `por ${n} ${n === 1 ? 'mes' : 'meses consecutivos'}`;
    }
    if (origPriceEl) origPriceEl.textContent = formatMoney(price);
    
    if (totalIntEl) {
      if (isDebit) {
        totalIntEl.textContent = '$0 (Débito al Contado)';
        totalIntEl.className = 'text-emerald';
      } else {
        totalIntEl.textContent = hasInt 
          ? `${formatMoney(totalInterest)} (${calcState.monthlyRate}% mensual)` 
          : '$0 (Sin Interés)';
        totalIntEl.className = hasInt ? 'text-rose' : 'text-emerald';
      }
    }

    if (finalTotalEl) finalTotalEl.textContent = formatMoney(totalCost);
    if (guardAmountEl) guardAmountEl.textContent = formatMoney(protectedSavingsAmount);
    if (baseIncomeEl) baseIncomeEl.textContent = formatMoney(income);

    // Impact Bars
    const remainingFreeEl = document.getElementById('calc-remaining-free-budget');
    const freeBarEl = document.getElementById('calc-free-budget-bar');
    const cupoTextEl = document.getElementById('calc-card-cupo-usage-text');
    const cupoBarEl = document.getElementById('calc-card-cupo-bar');

    if (remainingFreeEl) {
      remainingFreeEl.textContent = formatMoney(remainingFreeAfterPayment);
      remainingFreeEl.style.color = remainingFreeAfterPayment < 0 ? '#FB7185' : '#38BDF8';
    }

    if (freeBarEl && income > 0) {
      const freePct = Math.max(0, Math.min(100, Math.round((remainingFreeAfterPayment / income) * 100)));
      freeBarEl.style.width = `${freePct}%`;
      freeBarEl.className = `progress-bar-fill ${remainingFreeAfterPayment < 0 ? 'fill-rose' : 'fill-cyan'}`;
    }

    if (cupoTextEl) {
      if (isDebit) {
        cupoTextEl.textContent = '💵 Tarjeta de Débito: Sin cupo mensual de crédito';
      } else {
        cupoTextEl.textContent = selectedCard 
          ? `${cupoUsagePercentAfter}% proyectado (Disp: ${formatMoney(Math.max(0, cardAvail - price))})`
          : '⚠️ Requiere registrar tarjeta';
      }
    }

    if (cupoBarEl) {
      cupoBarEl.style.width = isDebit ? '0%' : `${cupoUsagePercentAfter}%`;
      cupoBarEl.className = `progress-bar-fill ${cupoUsagePercentAfter > 85 ? 'fill-rose' : (cupoUsagePercentAfter > 60 ? 'fill-amber' : 'fill-emerald')}`;
    }

    // 5. Smart Financial Health Verdict & Diagnosis Callout
    updateVerdict({
      hasCard: !!selectedCard,
      cardsCount: globalState.cards.length,
      isDebit,
      price,
      monthlyInstallment,
      remainingFreeAfterPayment,
      isExceedingCupo,
      cardAvail,
      savingsGuardPercent: calcState.savingsGuardPercent,
      protectedSavingsAmount,
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
            <strong>Debes ingresar al menos 1 tarjeta para hacer un pago</strong>
            <p class="text-subtle" style="font-size: 0.8rem; margin-top: 0.15rem;">Registra tu tarjeta para conocer tu cupo disponible y evaluar las cuotas.</p>
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
          <span style="color: #6EE7B7; font-size: 0.85rem; font-weight: 600;">✓ Pago directo (1 cuota sin interés)</span>
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

    if (!data.hasCard) {
      // REQUIRE CARD FIRST
      badge.className = 'status-indicator-badge status-warning';
      badgeText.textContent = 'Tarjeta Requerida';
      callout.className = 'diagnosis-callout warning';
      calloutIcon.textContent = '💳';
      calloutTitle.textContent = 'Debes ingresar al menos 1 tarjeta para hacer un pago';
      calloutDesc.textContent = 'Para calcular con precisión el impacto en tu presupuesto y registrar el pago, necesitas agregar al menos 1 tarjeta.';
      if (btnCommit) {
        btnCommit.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span>+ Registrar Tarjeta para Pagar</span>
        `;
      }
    } else if (data.isExceedingCupo) {
      // DANGER: CUPO EXCEEDED
      badge.className = 'status-indicator-badge status-danger';
      badgeText.textContent = 'Cupo Insuficiente';
      callout.className = 'diagnosis-callout danger';
      calloutIcon.textContent = '🚫';
      calloutTitle.textContent = 'La compra excede el cupo disponible';
      calloutDesc.textContent = `Esta compra de ${formatMoney(data.price)} supera tu cupo disponible en esta tarjeta (${formatMoney(data.cardAvail)}). Considera abonar parte al contado o elegir otra tarjeta.`;
      if (btnCommit) {
        btnCommit.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Añadir a mis Cuotas Activas</span>
        `;
      }
    } else if (data.remainingFreeAfterPayment < 0) {
      // DANGER: CANNIBALIZES PROTECTED SAVINGS
      badge.className = 'status-indicator-badge status-danger';
      badgeText.textContent = 'Compromete tu Ahorro';
      callout.className = 'diagnosis-callout danger';
      calloutIcon.textContent = '⚠️';
      calloutTitle.textContent = `Alerta: Canibaliza tu ${data.savingsGuardPercent}% de Ahorro`;
      calloutDesc.textContent = `Pagar este monto de ${formatMoney(data.monthlyInstallment)} te dejaría con déficit de ${formatMoney(Math.abs(data.remainingFreeAfterPayment))} respecto a tu meta de ahorro mensual de ${formatMoney(data.protectedSavingsAmount)}.`;
      if (btnCommit) {
        btnCommit.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>${data.isDebit ? 'Registrar Gasto de Débito' : 'Añadir a mis Cuotas Activas'}</span>
        `;
      }
    } else {
      // SAFE: GREEN LIGHT
      badge.className = 'status-indicator-badge status-safe';
      badgeText.textContent = data.isDebit ? '¡Compra al Contado Lista!' : '¡Compra Saludable y Segura!';
      callout.className = 'diagnosis-callout safe';
      calloutIcon.textContent = '✅';
      calloutTitle.textContent = data.isDebit ? 'Pago al Contado con Débito' : '¡Compra Recomendada y Segura!';
      calloutDesc.textContent = data.isDebit 
        ? `El pago al contado de ${formatMoney(data.price)} encaja en tu presupuesto mensual disponible y respeta tu meta del ${data.savingsGuardPercent}% de ahorro.`
        : `La cuota mensual de ${formatMoney(data.monthlyInstallment)} encaja perfectamente en tu presupuesto disponible y respeta tu meta del ${data.savingsGuardPercent}% de ahorro protegido.`;
      if (btnCommit) {
        btnCommit.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>${data.isDebit ? 'Registrar Pago al Contado (Débito)' : 'Añadir a mis Cuotas Activas'}</span>
        `;
      }
    }
  }

  function commitPurchase() {
    const { formatMoney } = FinanStore;
    const globalState = FinanStore.getState();
    const cardSelect = document.getElementById('calc-card-select');
    const cardId = cardSelect ? cardSelect.value : null;

    if (!globalState.cards || globalState.cards.length === 0 || !cardId) {
      FinanApp.showToast('Debes ingresar al menos 1 tarjeta para hacer un pago o compra.', 'danger');
      FinanApp.openModal('modal-card');
      return;
    }

    if (!calcState.productPrice || calcState.productPrice <= 0) {
      FinanApp.showToast('Ingresa un valor válido para la compra', 'info');
      return;
    }

    const card = globalState.cards.find(c => c.id === cardId);
    const isDebit = card && card.type === 'debito';

    if (isDebit) {
      // Débito se registra como compromiso / pago directo al contado
      FinanStore.addInstallment({
        name: `${calcState.productName || 'Compra al contado'} (${card.alias})`,
        monthlyAmount: calcState.productPrice,
        totalInstallments: 1,
        currentInstallment: 1,
        remainingMonths: 1,
        cardId: cardId,
        totalPurchase: calcState.productPrice
      });
      FinanApp.showToast(`¡Pago al contado de ${formatMoney(calcState.productPrice)} registrado con tu tarjeta de Débito!`, 'success');
      return;
    }

    const n = Math.max(1, calcState.installments);
    let monthlyInstallment = Math.round(calcState.productPrice / n);
    if (calcState.hasInterest && calcState.monthlyRate > 0 && n > 1) {
      const r = calcState.monthlyRate / 100;
      const factor = Math.pow(1 + r, n);
      monthlyInstallment = Math.round(calcState.productPrice * (r * factor) / (factor - 1));
    }

    FinanStore.addInstallment({
      name: calcState.productName || 'Compra en cuotas',
      monthlyAmount: monthlyInstallment,
      totalInstallments: n,
      currentInstallment: 1,
      remainingMonths: n,
      cardId: cardId,
      totalPurchase: calcState.productPrice
    });

    FinanApp.showToast(`¡Compromiso de ${formatMoney(monthlyInstallment)}/mes añadido a tus finanzas!`, 'success');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    init,
    recalculate,
    setValues
  };
})();
