/**
 * FINANSY — INTERACTIVE ISOLATED DEMONSTRATION MODULE
 * Entorno de simulación sandbox en ventana emergente (modal).
 * NO altera ni sobreescribe los datos reales configurados en FinanStore ni en localStorage.
 */

const FinanDemo = (() => {
  // Perfil Financiero Simulado Aislado (Sandbox)
  const demoProfile = {
    monthlyIncome: 1200000,
    fixedExpenses: 420000,
    existingInstallments: 45000,
    cards: {
      demo_card_1: {
        id: 'demo_card_1',
        alias: 'Santander Black Titanium',
        limit: 2500000,
        used: 650000
      },
      demo_card_2: {
        id: 'demo_card_2',
        alias: 'CMR Falabella Pro',
        limit: 1200000,
        used: 280000
      }
    }
  };

  // Presets Demostrativos
  const demoPresets = {
    macbook: {
      name: 'MacBook Air M3 15" 512GB',
      price: 1199990,
      cardId: 'demo_card_1',
      hasInterest: false,
      rate: 1.85,
      installments: 6,
      guardPercent: 20
    },
    ps5: {
      name: 'PlayStation 5 Pro Digital',
      price: 649990,
      cardId: 'demo_card_1',
      hasInterest: false,
      rate: 1.85,
      installments: 3,
      guardPercent: 20
    },
    bike: {
      name: 'Bicicleta Eléctrica Plegable',
      price: 450000,
      cardId: 'demo_card_2',
      hasInterest: false,
      rate: 2.10,
      installments: 12,
      guardPercent: 25
    },
    travel: {
      name: 'Paquete Vacaciones Caribe (Vuelos + Hotel)',
      price: 1500000,
      cardId: 'demo_card_1',
      hasInterest: true,
      rate: 1.85,
      installments: 12,
      guardPercent: 20
    }
  };

  let demoState = { ...demoPresets.macbook };
  let isInitialized = false;

  function init() {
    if (isInitialized) return;
    isInitialized = true;

    // Presets Click
    document.querySelectorAll('.demo-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetKey = btn.getAttribute('data-demo-preset');
        if (demoPresets[presetKey]) {
          document.querySelectorAll('.demo-preset-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          applyPreset(demoPresets[presetKey]);
        }
      });
    });

    // Inputs
    const nameInput = document.getElementById('demo-product-name');
    const priceInput = document.getElementById('demo-product-price');
    const cardSelect = document.getElementById('demo-card-select');
    const radioNo = document.getElementById('demo-radio-interest-no');
    const radioYes = document.getElementById('demo-radio-interest-yes');
    const rateInput = document.getElementById('demo-interest-rate');
    const rateWrap = document.getElementById('demo-custom-rate-wrap');
    const instSlider = document.getElementById('demo-installments-slider');
    const instDisplay = document.getElementById('demo-installments-display');
    const guardSlider = document.getElementById('demo-savings-guard-slider');
    const guardBadge = document.getElementById('demo-savings-guard-percent');

    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        demoState.name = e.target.value;
      });
    }

    if (priceInput) {
      priceInput.addEventListener('input', (e) => {
        demoState.price = Math.max(0, Number(e.target.value) || 0);
        recalculate();
      });
    }

    if (cardSelect) {
      cardSelect.addEventListener('change', (e) => {
        demoState.cardId = e.target.value;
        recalculate();
      });
    }

    if (radioNo && radioYes) {
      const handleInterestChange = () => {
        demoState.hasInterest = radioYes.checked;
        if (rateWrap) rateWrap.style.display = demoState.hasInterest ? 'block' : 'none';
        recalculate();
      };
      radioNo.addEventListener('change', handleInterestChange);
      radioYes.addEventListener('change', handleInterestChange);
    }

    if (rateInput) {
      rateInput.addEventListener('input', (e) => {
        demoState.rate = Math.max(0, Number(e.target.value) || 0);
        recalculate();
      });
    }

    if (instSlider) {
      instSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value) || 1;
        demoState.installments = val;
        if (instDisplay) instDisplay.textContent = `${val} ${val === 1 ? 'cuota' : 'cuotas'}`;
        updatePills(val);
        recalculate();
      });
    }

    // Pills
    document.querySelectorAll('.demo-pill-installment').forEach(pill => {
      pill.addEventListener('click', () => {
        const c = Number(pill.getAttribute('data-demo-cuotas')) || 1;
        demoState.installments = c;
        if (instSlider) instSlider.value = c;
        if (instDisplay) instDisplay.textContent = `${c} ${c === 1 ? 'cuota' : 'cuotas'}`;
        updatePills(c);
        recalculate();
      });
    });

    if (guardSlider) {
      guardSlider.addEventListener('input', (e) => {
        const pct = Number(e.target.value) || 0;
        demoState.guardPercent = pct;
        if (guardBadge) guardBadge.textContent = `${pct}%`;
        recalculate();
      });
    }
  }

  function updatePills(activeCuotas) {
    document.querySelectorAll('.demo-pill-installment').forEach(pill => {
      const c = Number(pill.getAttribute('data-demo-cuotas'));
      pill.classList.toggle('active', c === activeCuotas);
    });
  }

  function applyPreset(preset) {
    demoState = { ...preset };

    const nameInput = document.getElementById('demo-product-name');
    const priceInput = document.getElementById('demo-product-price');
    const cardSelect = document.getElementById('demo-card-select');
    const radioNo = document.getElementById('demo-radio-interest-no');
    const radioYes = document.getElementById('demo-radio-interest-yes');
    const rateInput = document.getElementById('demo-interest-rate');
    const rateWrap = document.getElementById('demo-custom-rate-wrap');
    const instSlider = document.getElementById('demo-installments-slider');
    const instDisplay = document.getElementById('demo-installments-display');
    const guardSlider = document.getElementById('demo-savings-guard-slider');
    const guardBadge = document.getElementById('demo-savings-guard-percent');

    if (nameInput) nameInput.value = preset.name;
    if (priceInput) priceInput.value = preset.price;
    if (cardSelect) cardSelect.value = preset.cardId;
    
    if (radioNo && radioYes) {
      radioNo.checked = !preset.hasInterest;
      radioYes.checked = preset.hasInterest;
      if (rateWrap) rateWrap.style.display = preset.hasInterest ? 'block' : 'none';
    }

    if (rateInput) rateInput.value = preset.rate;
    if (instSlider) instSlider.value = preset.installments;
    if (instDisplay) instDisplay.textContent = `${preset.installments} ${preset.installments === 1 ? 'cuota' : 'cuotas'}`;
    if (guardSlider) guardSlider.value = preset.guardPercent;
    if (guardBadge) guardBadge.textContent = `${preset.guardPercent}%`;

    updatePills(preset.installments);
    recalculate();
  }

  function recalculate() {
    const { formatMoney } = FinanStore;

    const price = Math.max(0, demoState.price);
    const n = Math.max(1, demoState.installments);
    const hasInt = demoState.hasInterest;
    const monthlyRateDec = (demoState.rate || 0) / 100;
    const income = demoProfile.monthlyIncome;
    const totalFixed = demoProfile.fixedExpenses;
    const currentInstallments = demoProfile.existingInstallments;

    const selectedCard = demoProfile.cards[demoState.cardId] || demoProfile.cards.demo_card_1;

    // 1. Monthly installment calculation
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

    // 2. Budget & Protected Savings
    const protectedSavingsAmount = Math.round(income * (demoState.guardPercent / 100));
    const baseDiscretionary = Math.max(0, income - totalFixed - currentInstallments - protectedSavingsAmount);
    const remainingFreeAfterPayment = baseDiscretionary - monthlyInstallment;

    // 3. Card Cupo Impact
    const cardAvail = Math.max(0, selectedCard.limit - selectedCard.used);
    const cardLimit = selectedCard.limit;
    const isExceedingCupo = price > cardAvail;
    const cupoUsagePercentAfter = Math.min(100, Math.round(((selectedCard.used + price) / cardLimit) * 100));

    // 4. Update UI Outputs
    const heroPriceEl = document.getElementById('demo-monthly-installment-display');
    const heroPeriodEl = document.getElementById('demo-period-subtitle');
    const origPriceEl = document.getElementById('demo-original-price-display');
    const totalIntEl = document.getElementById('demo-total-interest-display');
    const finalTotalEl = document.getElementById('demo-final-total-display');
    const guardAmountEl = document.getElementById('demo-savings-guard-amount');
    const profileSavingsDisplay = document.getElementById('demo-profile-savings-display');
    const profileAvailDisplay = document.getElementById('demo-profile-avail-display');

    if (heroPriceEl) heroPriceEl.textContent = formatMoney(monthlyInstallment);
    if (heroPeriodEl) heroPeriodEl.textContent = `por ${n} ${n === 1 ? 'mes' : 'meses consecutivos'}`;
    if (origPriceEl) origPriceEl.textContent = formatMoney(price);
    
    if (totalIntEl) {
      totalIntEl.textContent = hasInt 
        ? `${formatMoney(totalInterest)} (${demoState.rate}% mensual)` 
        : '$0 (Sin Interés)';
      totalIntEl.className = hasInt ? 'text-rose' : 'text-emerald';
    }

    if (finalTotalEl) finalTotalEl.textContent = formatMoney(totalCost);
    if (guardAmountEl) guardAmountEl.textContent = formatMoney(protectedSavingsAmount);
    if (profileSavingsDisplay) profileSavingsDisplay.textContent = `${formatMoney(protectedSavingsAmount)} (${demoState.guardPercent}%)`;
    if (profileAvailDisplay) profileAvailDisplay.textContent = formatMoney(baseDiscretionary);

    // Impact Bars
    const remainingFreeEl = document.getElementById('demo-remaining-free-budget');
    const freeBarEl = document.getElementById('demo-free-budget-bar');
    const cupoTextEl = document.getElementById('demo-card-cupo-usage-text');
    const cupoBarEl = document.getElementById('demo-card-cupo-bar');

    if (remainingFreeEl) {
      remainingFreeEl.textContent = formatMoney(remainingFreeAfterPayment);
      remainingFreeEl.style.color = remainingFreeAfterPayment < 0 ? '#FB7185' : '#38BDF8';
    }

    if (freeBarEl && income > 0) {
      const freePct = Math.max(0, Math.min(100, Math.round((Math.max(0, remainingFreeAfterPayment) / income) * 100)));
      freeBarEl.style.width = `${freePct}%`;
      freeBarEl.className = `progress-bar-fill ${remainingFreeAfterPayment < 0 ? 'fill-rose' : 'fill-cyan'}`;
    }

    if (cupoTextEl) {
      cupoTextEl.textContent = `${cupoUsagePercentAfter}% proyectado (Disp: ${formatMoney(Math.max(0, cardAvail - price))})`;
    }

    if (cupoBarEl) {
      cupoBarEl.style.width = `${cupoUsagePercentAfter}%`;
      cupoBarEl.className = `progress-bar-fill ${cupoUsagePercentAfter > 85 ? 'fill-rose' : (cupoUsagePercentAfter > 60 ? 'fill-amber' : 'fill-emerald')}`;
    }

    // 5. Mini Animated Jar & Verdict Update
    updateVerdictAndJar({
      price,
      monthlyInstallment,
      remainingFreeAfterPayment,
      isExceedingCupo,
      cardAvail,
      savingsGuardPercent: demoState.guardPercent,
      protectedSavingsAmount,
      n
    });
  }

  function updateVerdictAndJar(data) {
    const { formatMoney } = FinanStore;
    const badge = document.getElementById('demo-status-badge');
    const badgeText = document.getElementById('demo-status-text');
    const callout = document.getElementById('demo-diagnosis-callout');
    const calloutIcon = document.getElementById('demo-diagnosis-icon');
    const calloutTitle = document.getElementById('demo-diagnosis-title');
    const calloutDesc = document.getElementById('demo-diagnosis-desc');
    const jarWater = document.getElementById('demo-jar-water');
    const jarPct = document.getElementById('demo-jar-pct');

    if (!badge || !callout) return;

    if (data.isExceedingCupo) {
      // DANGER: CUPO EXCEEDED
      badge.className = 'status-indicator-badge status-danger';
      badgeText.textContent = 'Cupo Insuficiente';
      callout.className = 'diagnosis-callout danger';
      calloutIcon.textContent = '🚫';
      calloutTitle.textContent = 'La compra excede el cupo disponible';
      calloutDesc.textContent = `Esta compra de ${formatMoney(data.price)} supera el cupo disponible de la tarjeta (${formatMoney(data.cardAvail)}). Se recomienda abonar al contado o seleccionar otra tarjeta.`;
      
      if (jarWater) {
        jarWater.style.height = '20%';
        jarWater.className = 'demo-jar-water danger';
      }
      if (jarPct) jarPct.textContent = 'Cupo 🚫';

    } else if (data.remainingFreeAfterPayment < 0) {
      // DANGER: CANNIBALIZES SAVINGS
      badge.className = 'status-indicator-badge status-danger';
      badgeText.textContent = 'Compromete tu Ahorro';
      callout.className = 'diagnosis-callout danger';
      calloutIcon.textContent = '⚠️';
      calloutTitle.textContent = `Alerta: Canibaliza tu ${data.savingsGuardPercent}% de Ahorro`;
      calloutDesc.textContent = `Pagar una cuota de ${formatMoney(data.monthlyInstallment)} genera un déficit de ${formatMoney(Math.abs(data.remainingFreeAfterPayment))} sobre tu meta de ahorro mensual de ${formatMoney(data.protectedSavingsAmount)}. Te sugerimos aumentar cuotas o posponer la compra.`;
      
      if (jarWater) {
        jarWater.style.height = '25%';
        jarWater.className = 'demo-jar-water danger';
      }
      if (jarPct) jarPct.textContent = 'Riesgo';

    } else if (data.remainingFreeAfterPayment < 50000) {
      // WARNING: TIGHT MARGIN
      badge.className = 'status-indicator-badge status-warning';
      badgeText.textContent = 'Presupuesto Ajustado';
      callout.className = 'diagnosis-callout warning';
      calloutIcon.textContent = '⚡';
      calloutTitle.textContent = 'Compra Viable pero Ajustada';
      calloutDesc.textContent = `Tu ahorro del ${data.savingsGuardPercent}% (${formatMoney(data.protectedSavingsAmount)}) se mantiene a salvo, pero tu margen libre quedará en solo ${formatMoney(data.remainingFreeAfterPayment)} al mes durante los próximos ${data.n} meses.`;
      
      if (jarWater) {
        jarWater.style.height = '50%';
        jarWater.className = 'demo-jar-water warning';
      }
      if (jarPct) jarPct.textContent = '50%';

    } else {
      // SAFE: GREEN LIGHT
      badge.className = 'status-indicator-badge status-safe';
      badgeText.textContent = '¡Compra Saludable y Segura!';
      callout.className = 'diagnosis-callout safe';
      calloutIcon.textContent = '✅';
      calloutTitle.textContent = '¡Compra Recomendada y Segura!';
      calloutDesc.textContent = `La cuota mensual de ${formatMoney(data.monthlyInstallment)} encaja perfectamente en el presupuesto disponible y respeta íntegramente la meta del ${data.savingsGuardPercent}% de ahorro protegido.`;
      
      if (jarWater) {
        jarWater.style.height = '80%';
        jarWater.className = 'demo-jar-water';
      }
      if (jarPct) jarPct.textContent = '100% Ok';
    }
  }

  function loadDemoSimulation() {
    init();
    FinanApp.openModal('modal-demo');
    recalculate();
    FinanApp.showToast('🚀 Demostración interactiva abierta en ventana emergente (Tus datos reales no se modifican)', 'info');
  }

  return {
    init,
    loadDemoSimulation
  };
})();
