/**
 * FINANSY — MAIN APPLICATION CONTROLLER
 * Orquesta navegación, modales, PWA, recordatorios, onboarding/tutorial y reactividad global.
 */

const FinanApp = (() => {
  let deferredInstallPrompt = null;
  let currentOnboardingStep = 1;
  const TOTAL_ONBOARDING_STEPS = 4;

  function init() {
    setupTabNavigation();
    setupModals();
    setupForms();
    setupHeaderButtons();
    setupPWA();
    setupPaymentAlerts();
    setupOnboarding();

    // Inicializar calculadora
    FinanCalculator.init();

    // Suscribirse a cambios en el Store para actualizar toda la UI
    FinanStore.subscribe(renderAll);

    // Primer renderizado con los datos actuales
    const state = FinanStore.getState();
    renderAll(state);

    // Abrir automáticamente el mini tutorial y bienvenida si es la primera vez
    if (!state.hasCompletedOnboarding) {
      setTimeout(() => {
        openOnboarding();
      }, 300);
    }
  }

  function renderAll(state) {
    const { formatMoney } = FinanStore;

    // 1. Barra de Resumen Global Superior
    const income = state.monthlyIncome || 0;
    const totalFixed = state.fixedExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const totalInst = state.installments.reduce((acc, i) => acc + (i.monthlyAmount || 0), 0);
    const totalCommitted = totalFixed + totalInst;
    const available = Math.max(0, income - totalCommitted);
    const commitRate = income > 0 ? Math.min(100, Math.round((totalCommitted / income) * 100)) : 0;

    const incEl = document.getElementById('global-income-display');
    const expEl = document.getElementById('global-expenses-display');
    const availEl = document.getElementById('global-available-display');
    const savEl = document.getElementById('global-savings-display');
    const commitRateEl = document.getElementById('global-commit-rate');
    const freeRateEl = document.getElementById('global-free-rate');

    if (incEl) incEl.textContent = formatMoney(income);
    if (expEl) expEl.textContent = formatMoney(totalCommitted);
    if (availEl) availEl.textContent = formatMoney(available);
    if (savEl) savEl.textContent = formatMoney(state.savingsBalance);
    if (commitRateEl) commitRateEl.textContent = `${commitRate}% del ingreso comprometido`;
    if (freeRateEl) freeRateEl.textContent = `${100 - commitRate}% libre para metas/ahorro`;

    // 2. Renderizar Vistas
    FinanJarra.render(state);
    FinanCards.render(state);
    FinanGoals.render(state);
    FinanCalculator.recalculate();
  }

  /* ---------------- TAB NAVIGATION ---------------- */
  function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });
  }

  function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.nav-tab').forEach(t => {
      const isTarget = t.getAttribute('data-tab') === tabName;
      t.classList.toggle('active', isTarget);
      t.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    // Update panels
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const targetPanel = document.getElementById(`view-${tabName}`);
    if (targetPanel) {
      targetPanel.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /* ---------------- MODALS MANAGEMENT ---------------- */
  function setupModals() {
    // Close button events
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        closeModal(modalId);
      });
    });

    // Close on overlay backdrop click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal(modal.id);
        }
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => {
          if (m.style.display !== 'none') closeModal(m.id);
        });
      }
    });

    // Specific triggers
    document.getElementById('btn-edit-income')?.addEventListener('click', () => {
      const input = document.getElementById('input-monthly-income');
      if (input) input.value = FinanStore.getState().monthlyIncome;
      openModal('modal-income');
    });

    document.getElementById('btn-add-expense-modal')?.addEventListener('click', () => {
      document.getElementById('form-expense')?.reset();
      openModal('modal-expense');
    });

    document.getElementById('btn-add-installment-modal')?.addEventListener('click', () => {
      document.getElementById('form-installment')?.reset();
      openModal('modal-installment');
    });

    document.getElementById('btn-open-create-goal')?.addEventListener('click', () => {
      document.getElementById('form-goal')?.reset();
      openModal('modal-goal');
    });

    document.getElementById('btn-empty-create-goal')?.addEventListener('click', () => {
      document.getElementById('form-goal')?.reset();
      openModal('modal-goal');
    });

    document.getElementById('btn-open-create-card')?.addEventListener('click', () => {
      document.getElementById('form-card')?.reset();
      openModal('modal-card');
    });

    document.getElementById('btn-empty-create-card')?.addEventListener('click', () => {
      document.getElementById('form-card')?.reset();
      openModal('modal-card');
    });

    document.getElementById('btn-quick-deposit')?.addEventListener('click', () => {
      document.getElementById('form-deposit')?.reset();
      openModal('modal-deposit');
    });

    document.getElementById('btn-quick-withdraw')?.addEventListener('click', () => {
      document.getElementById('form-withdraw')?.reset();
      openModal('modal-withdraw');
    });

    document.getElementById('btn-privacy-info')?.addEventListener('click', () => {
      openModal('modal-privacy');
    });

    document.getElementById('btn-reset-all-data')?.addEventListener('click', () => {
      if (confirm('¿Estás seguro de que deseas reiniciar todos los datos a $0?')) {
        FinanStore.resetAllData();
        closeModal('modal-privacy');
        showToast('Todos los datos fueron reiniciados a $0', 'info');
      }
    });

    document.getElementById('btn-open-tutorial')?.addEventListener('click', () => {
      openOnboarding();
    });
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'flex';
      const firstInput = modal.querySelector('input:not([type="hidden"]), select');
      if (firstInput) setTimeout(() => firstInput.focus(), 50);
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
  }

  /* ---------------- ONBOARDING WIZARD & MINI TUTORIAL ---------------- */
  function setupOnboarding() {
    const btnNext = document.getElementById('btn-onboarding-next');
    const btnPrev = document.getElementById('btn-onboarding-prev');
    const btnFinish = document.getElementById('btn-onboarding-finish');

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (currentOnboardingStep < TOTAL_ONBOARDING_STEPS) {
          goToOnboardingStep(currentOnboardingStep + 1);
        }
      });
    }

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (currentOnboardingStep > 1) {
          goToOnboardingStep(currentOnboardingStep - 1);
        }
      });
    }

    if (btnFinish) {
      btnFinish.addEventListener('click', () => {
        const incomeInput = document.getElementById('onboarding-income-input');
        const initialIncome = Number(incomeInput?.value) || 0;
        if (initialIncome > 0) {
          FinanStore.updateIncome(initialIncome);
        }
        FinanStore.setOnboardingCompleted(true);
        closeModal('modal-onboarding');
        showToast('¡Bienvenido a FinanSY! Tu espacio está listo para ingresar tus datos.', 'success');
      });
    }
  }

  function openOnboarding() {
    goToOnboardingStep(1);
    openModal('modal-onboarding');
  }

  function goToOnboardingStep(stepNumber) {
    currentOnboardingStep = stepNumber;

    // Actualizar slides
    document.querySelectorAll('.onboarding-slide').forEach(slide => {
      const step = Number(slide.getAttribute('data-onboarding-step'));
      slide.classList.toggle('active', step === stepNumber);
    });

    // Actualizar dots
    document.querySelectorAll('.step-dot').forEach(dot => {
      const step = Number(dot.getAttribute('data-step-dot'));
      dot.classList.toggle('active', step === stepNumber);
    });

    // Actualizar botones de navegación
    const btnPrev = document.getElementById('btn-onboarding-prev');
    const btnNext = document.getElementById('btn-onboarding-next');
    const btnFinish = document.getElementById('btn-onboarding-finish');

    if (btnPrev) {
      btnPrev.style.visibility = stepNumber === 1 ? 'hidden' : 'visible';
    }

    if (btnNext && btnFinish) {
      if (stepNumber === TOTAL_ONBOARDING_STEPS) {
        btnNext.style.display = 'none';
        btnFinish.style.display = 'inline-flex';
      } else {
        btnNext.style.display = 'inline-flex';
        btnFinish.style.display = 'none';
      }
    }
  }

  /* ---------------- FORM SUBMISSIONS ---------------- */
  function setupForms() {
    // Form Ingreso
    document.getElementById('form-income')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = Number(document.getElementById('input-monthly-income').value) || 0;
      FinanStore.updateIncome(val);
      closeModal('modal-income');
      showToast(`Ingreso mensual actualizado a ${FinanStore.formatMoney(val)}`, 'success');
    });

    // Form Gasto Fijo
    document.getElementById('form-expense')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('input-expense-name').value;
      const amount = Number(document.getElementById('input-expense-amount').value) || 0;
      FinanStore.addExpense(name, amount);
      closeModal('modal-expense');
      showToast(`Gasto fijo "${name}" registrado`, 'success');
    });

    // Form Meta
    document.getElementById('form-goal')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('input-goal-name').value;
      const target = Number(document.getElementById('input-goal-target').value) || 0;
      const current = Number(document.getElementById('input-goal-current').value) || 0;
      const emojiInput = document.querySelector('input[name="goal-emoji"]:checked');
      const emoji = emojiInput ? emojiInput.value : '🎯';

      FinanStore.addGoal({ name, target, current, emoji });
      closeModal('modal-goal');
      showToast(`Meta "${name}" creada con éxito`, 'success');
    });

    // Form Tarjeta
    document.getElementById('form-card')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const alias = document.getElementById('input-card-alias').value;
      const type = document.getElementById('input-card-type').value;
      const color = document.getElementById('input-card-color').value;
      const limit = Number(document.getElementById('input-card-limit').value) || 0;
      const used = Number(document.getElementById('input-card-used').value) || 0;
      const interestRate = Number(document.getElementById('input-card-interest').value) || 0;
      const billingDay = Number(document.getElementById('input-card-billing-day').value) || 15;
      const paymentDueDay = Number(document.getElementById('input-card-due-day').value) || 5;
      const reminderDaysBefore = Number(document.getElementById('input-card-reminder-days').value) || 3;

      FinanStore.addCard({ 
        alias, 
        type, 
        color, 
        limit, 
        used, 
        interestRate, 
        billingDay,
        paymentDueDay,
        reminderDaysBefore
      });
      closeModal('modal-card');
      showToast(`Tarjeta "${alias}" agregada con vencimiento día ${paymentDueDay}`, 'success');
    });

    // Form Abonar a Jarra
    document.getElementById('form-deposit')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = Number(document.getElementById('input-deposit-amount').value) || 0;
      FinanStore.depositSavings(amount);
      closeModal('modal-deposit');
      showToast(`¡Abonaste ${FinanStore.formatMoney(amount)} a tu jarra de ahorro!`, 'success');
    });

    // Form Retirar de Jarra
    document.getElementById('form-withdraw')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = Number(document.getElementById('input-withdraw-amount').value) || 0;
      FinanStore.withdrawSavings(amount);
      closeModal('modal-withdraw');
      showToast(`Retiraste ${FinanStore.formatMoney(amount)} de tu jarra de ahorro`, 'info');
    });

    // Form Configurar Jarra & Capacidad de Ahorro
    document.getElementById('form-jar-settings')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const rulePercent = document.getElementById('input-jar-rule').value;
      const ruleAmount = document.getElementById('input-jar-rule-amount').value;
      const target = document.getElementById('input-jar-target').value;
      const balance = document.getElementById('input-jar-balance').value;

      FinanStore.updateJarSettings({ balance, target, rulePercent, ruleAmount });
      closeModal('modal-jar-settings');
      showToast('Configuración de jarra y capacidad de ahorro guardada con éxito', 'success');
    });

    // Form Añadir Compromiso en Cuotas / Deuda
    document.getElementById('form-installment')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('input-installment-name').value;
      const monthlyAmount = Number(document.getElementById('input-installment-amount').value) || 0;
      const remainingMonths = Number(document.getElementById('input-installment-months').value) || 1;

      FinanStore.addInstallment({ name, monthlyAmount, remainingMonths });
      closeModal('modal-installment');
      showToast(`Compromiso de cuota "${name}" por ${FinanStore.formatMoney(monthlyAmount)}/mes registrado`, 'success');
    });
  }

  /* ---------------- HEADER BUTTONS & PWA ---------------- */
  function setupHeaderButtons() {
    document.getElementById('btn-quick-demo')?.addEventListener('click', () => {
      FinanDemo.loadDemoSimulation();
    });
  }

  function setupPWA() {
    // 1. Registrar Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(() => console.log('FinanSY ServiceWorker registrado.'))
          .catch(err => console.log('SW registration skipped:', err));
      });
    }

    // 2. Evento de instalación PWA en celular y escritorio
    const installBtn = document.getElementById('btn-install-pwa');
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (installBtn) {
        installBtn.style.display = 'inline-flex';
      }
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          const { outcome } = await deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            showToast('¡Instalando FinanSY en tu dispositivo!', 'success');
          }
          deferredInstallPrompt = null;
          installBtn.style.display = 'none';
        }
      });
    }
  }

  /* ---------------- NOTIFICACIONES DE RECORDATORIO ---------------- */
  function setupPaymentAlerts() {
    const notifyBtn = document.getElementById('btn-request-notifications');
    if (notifyBtn) {
      notifyBtn.addEventListener('click', async () => {
        if (!('Notification' in window)) {
          showToast('Tu navegador no soporta notificaciones de escritorio.', 'info');
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          showToast('🔔 ¡Alertas activadas para recordatorios de pago!', 'success');
          checkUrgentPaymentNotifications();
        } else {
          showToast('Permiso de notificaciones no concedido.', 'info');
        }
      });
    }

    // Revisar al iniciar si hay notificaciones permitidas
    if ('Notification' in window && Notification.permission === 'granted') {
      checkUrgentPaymentNotifications();
    }
  }

  function checkUrgentPaymentNotifications() {
    const state = FinanStore.getState();
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    state.cards.forEach(card => {
      if (card.type === 'credito' && card.lastPaidMonth !== currentMonthKey) {
        const daysInfo = FinanCards.getDaysUntilDue(card.paymentDueDay || 5);
        if (daysInfo.daysRemaining <= (card.reminderDaysBefore || 3) && card.used > 0) {
          new Notification(`💳 Recordatorio de Pago — ${card.alias}`, {
            body: `Tu pago vence en ${daysInfo.daysRemaining} días (${daysInfo.dueDateFormatted}). Monto pendiente: ${FinanStore.formatMoney(card.used)}.`,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2310B981"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'
          });
        }
      }
    });
  }

  /* ---------------- TOAST NOTIFICATIONS ---------------- */
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? '✓' : (type === 'danger' ? '✕' : 'ℹ');
    toast.innerHTML = `<span style="font-weight:bold;">${icon}</span> <span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    init,
    switchTab,
    openModal,
    closeModal,
    openOnboarding,
    showToast
  };
})();

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  FinanApp.init();
});
