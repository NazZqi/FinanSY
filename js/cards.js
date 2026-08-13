/**
 * FINANSY — CARDS & PAYMENT REMINDERS MODULE
 * Gestión de tarjetas bancarias, visualización de cupos y recordatorios de pago.
 */

const FinanCards = (() => {

  function render(state) {
    const { formatMoney } = FinanStore;
    const cards = state.cards || [];

    // 1. Calcular Totales de Línea de Crédito
    const creditCards = cards.filter(c => c.type === 'credito');
    const totalLimit = creditCards.reduce((acc, c) => acc + (c.limit || 0), 0);
    const totalUsed = creditCards.reduce((acc, c) => acc + (c.used || 0), 0);
    const totalAvail = Math.max(0, totalLimit - totalUsed);

    // Actualizar Resumen Superior
    const limitEl = document.getElementById('cards-total-limit');
    const usedEl = document.getElementById('cards-total-used');
    const availEl = document.getElementById('cards-total-avail');
    const badgeEl = document.getElementById('cards-count-badge');

    if (limitEl) limitEl.textContent = formatMoney(totalLimit);
    if (usedEl) usedEl.textContent = formatMoney(totalUsed);
    if (availEl) availEl.textContent = formatMoney(totalAvail);
    if (badgeEl) badgeEl.textContent = cards.length;

    // 2. Renderizar Recordatorios de Pagos Próximos
    renderPaymentReminders(cards);

    // 3. Renderizar Deck de Tarjetas 3D
    const deckContainer = document.getElementById('cards-deck-container');
    const emptyState = document.getElementById('cards-empty-state');

    if (!deckContainer) return;

    if (cards.length === 0) {
      deckContainer.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      populateCalculatorSelect(cards);
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    deckContainer.innerHTML = cards.map(card => {
      const avail = Math.max(0, card.limit - card.used);
      const usedPercent = card.limit > 0 ? Math.min(100, Math.round((card.used / card.limit) * 100)) : 0;
      
      const typeLabel = card.type === 'credito' 
        ? 'Crédito' 
        : (card.type === 'debito' ? 'Débito' : 'Prepago Digital');

      const isPaid = card.lastPaidMonth === currentMonthKey;
      const daysInfo = getDaysUntilDue(card.paymentDueDay || 5);

      let reminderBadge = '';
      if (isPaid) {
        reminderBadge = `<span class="card-due-badge badge-paid">✓ Pagado este mes</span>`;
      } else if (daysInfo.daysRemaining === 0) {
        reminderBadge = `<span class="card-due-badge badge-urgent">🚨 ¡Vence Hoy!</span>`;
      } else if (daysInfo.daysRemaining <= 3) {
        reminderBadge = `<span class="card-due-badge badge-warning">⚠️ Vence en ${daysInfo.daysRemaining}d</span>`;
      } else {
        reminderBadge = `<span class="card-due-badge">📅 Pago: día ${card.paymentDueDay || 5}</span>`;
      }

      return `
        <div class="visual-credit-card ${card.color || 'gradient-dark'}" data-card-id="${card.id}">
          <div class="card-top-row">
            <div class="card-chip"></div>
            <div class="card-badges-wrap">
              ${reminderBadge}
              <span class="card-type-tag">${typeLabel}</span>
            </div>
          </div>

          <div class="card-middle-row">
            <div class="card-alias-name">${escapeHtml(card.alias)}</div>
          </div>

          <div class="card-bottom-row">
            <div class="card-cupo-labels">
              <span>Cupo Utilizado (${usedPercent}%)</span>
              <strong>${formatMoney(card.used)}</strong>
            </div>

            <div class="progress-bar-bg" style="background: rgba(0,0,0,0.3); height: 7px;">
              <div class="progress-bar-fill fill-amber" style="width: ${usedPercent}%;"></div>
            </div>

            <div class="card-cupo-labels" style="margin-top: 0.2rem;">
              <span>Disponible:</span>
              <strong style="color: #6EE7B7; font-size: 0.95rem;">${formatMoney(avail)}</strong>
            </div>

            <div class="card-action-bar">
              <span>📅 Corte: Día ${card.billingDay || 15} · Vencimiento: Día ${card.paymentDueDay || 5}</span>
              <button class="card-btn-delete" data-delete-card-id="${card.id}" title="Eliminar tarjeta">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach delete handlers
    deckContainer.querySelectorAll('[data-delete-card-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-delete-card-id');
        FinanStore.deleteCard(id);
        FinanApp.showToast('Tarjeta eliminada', 'info');
      });
    });

    // Actualizar el Select de la calculadora
    populateCalculatorSelect(cards);
  }

  /* ---------------- RECORDATORIOS DE PAGO ---------------- */
  function renderPaymentReminders(cards) {
    const container = document.getElementById('card-reminders-container');
    if (!container) return;

    const creditCards = cards.filter(c => c.type === 'credito');
    if (creditCards.length === 0) {
      container.innerHTML = `<div class="reminder-empty-note">No tienes tarjetas de crédito con vencimientos registrados.</div>`;
      return;
    }

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Ordenar por urgencia de vencimiento
    const sortedCards = [...creditCards].sort((a, b) => {
      const aPaid = a.lastPaidMonth === currentMonthKey;
      const bPaid = b.lastPaidMonth === currentMonthKey;
      if (aPaid && !bPaid) return 1;
      if (!aPaid && bPaid) return -1;
      return getDaysUntilDue(a.paymentDueDay || 5).daysRemaining - getDaysUntilDue(b.paymentDueDay || 5).daysRemaining;
    });

    container.innerHTML = sortedCards.map(card => {
      const isPaid = card.lastPaidMonth === currentMonthKey;
      const daysInfo = getDaysUntilDue(card.paymentDueDay || 5);
      const { formatMoney } = FinanStore;

      let statusBadge = '';
      let statusClass = '';

      if (isPaid) {
        statusBadge = `<span class="reminder-pill pill-paid">✓ Pagado este mes</span>`;
        statusClass = 'reminder-item-paid';
      } else if (daysInfo.daysRemaining === 0) {
        statusBadge = `<span class="reminder-pill pill-danger">🚨 Vence Hoy</span>`;
        statusClass = 'reminder-item-urgent';
      } else if (daysInfo.daysRemaining <= 3) {
        statusBadge = `<span class="reminder-pill pill-warning">⚠️ Vence en ${daysInfo.daysRemaining} días (${daysInfo.dueDateFormatted})</span>`;
        statusClass = 'reminder-item-soon';
      } else {
        statusBadge = `<span class="reminder-pill pill-normal">📅 Vence el ${daysInfo.dueDateFormatted} (en ${daysInfo.daysRemaining} días)</span>`;
      }

      return `
        <div class="reminder-card-item ${statusClass}">
          <div class="reminder-item-left">
            <div class="reminder-item-title">
              <strong>${escapeHtml(card.alias)}</strong>
              ${statusBadge}
            </div>
            <div class="reminder-item-meta">
              <span>Monto por pagar (consumo actual): <strong class="${card.used > 0 ? 'text-rose' : 'text-muted'}">${formatMoney(card.used)}</strong></span>
            </div>
          </div>

          <div class="reminder-item-actions">
            ${!isPaid ? `
              <button class="btn-xs btn-primary" data-pay-card="${card.id}" title="Marcar como pagada y liberar cupo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Marcar Pagada</span>
              </button>
            ` : `
              <button class="btn-xs btn-ghost" data-unpay-card="${card.id}" title="Deshacer estado de pago">
                <span>Deshacer</span>
              </button>
            `}
            <button class="btn-xs btn-outline" data-calendar-card="${card.id}" title="Agregar recordatorio a Google Calendar / iCal">
              📅 Recordar
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach Event Handlers
    container.querySelectorAll('[data-pay-card]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-pay-card');
        FinanStore.markCardAsPaid(id);
        FinanApp.showToast('¡Estado de cuenta marcado como pagado! Cupo liberado.', 'success');
      });
    });

    container.querySelectorAll('[data-unpay-card]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-unpay-card');
        FinanStore.unmarkCardAsPaid(id);
        FinanApp.showToast('Estado de pago restablecido', 'info');
      });
    });

    container.querySelectorAll('[data-calendar-card]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-calendar-card');
        const card = cards.find(c => c.id === id);
        if (card) downloadCalendarReminder(card);
      });
    });
  }

  /* ---------------- CÁLCULO DE DÍAS HASTA EL VENCIMIENTO ---------------- */
  function getDaysUntilDue(dueDay) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    let targetDate = new Date(currentYear, currentMonth, dueDay);

    // Si ya pasó el día de este mes, la fecha objetivo es el próximo mes
    if (currentDay > dueDay) {
      targetDate = new Date(currentYear, currentMonth + 1, dueDay);
    }

    // Calcular diferencia en días
    const diffTime = targetDate.getTime() - new Date(currentYear, currentMonth, currentDay).getTime();
    const daysRemaining = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));

    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dueDateFormatted = `${dueDay} de ${months[targetDate.getMonth()]}`;

    return {
      daysRemaining,
      dueDateFormatted,
      targetDate
    };
  }

  /* ---------------- EXPORTAR RECORDATORIO A CALENDARIO (.ICS) ---------------- */
  function downloadCalendarReminder(card) {
    const daysInfo = getDaysUntilDue(card.paymentDueDay || 5);
    const target = daysInfo.targetDate;
    
    const yearStr = target.getFullYear();
    const monthStr = String(target.getMonth() + 1).padStart(2, '0');
    const dayStr = String(target.getDate()).padStart(2, '0');
    
    const dateStamp = `${yearStr}${monthStr}${dayStr}`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FinanSY//Recordatorios de Pago//ES',
      'BEGIN:VEVENT',
      `UID:finansy-${card.id}-${dateStamp}@finansy.local`,
      `DTSTAMP:${dateStamp}T090000Z`,
      `DTSTART;VALUE=DATE:${dateStamp}`,
      `SUMMARY:💳 Pagar Tarjeta ${card.alias} (FinanSY)`,
      `DESCRIPTION:Recordatorio de vencimiento para la tarjeta ${card.alias}. Monto pendiente aproximado: ${FinanStore.formatMoney(card.used)}. Revisa tu app FinanSY.`,
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:Recordatorio: Pagar ${card.alias} mañana`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pago_${card.alias.replace(/\s+/g, '_').toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    FinanApp.showToast(`Recordatorio descargado para tu calendario (.ics)`, 'success');
  }

  function populateCalculatorSelect(cards) {
    const select = document.getElementById('calc-card-select');
    if (!select) return;

    const currentVal = select.value;

    if (!cards || cards.length === 0) {
      select.innerHTML = '<option value="">No hay tarjetas disponibles</option>';
      return;
    }

    select.innerHTML = cards.map(c => {
      const typeLabel = c.type === 'credito' ? 'Crédito' : (c.type === 'debito' ? 'Débito' : 'Prepago');
      const avail = Math.max(0, c.limit - c.used);
      return `<option value="${c.id}">${escapeHtml(c.alias)} (${typeLabel}) — Disp: ${FinanStore.formatMoney(avail)}</option>`;
    }).join('');

    if (currentVal && cards.some(c => c.id === currentVal)) {
      select.value = currentVal;
    } else if (cards.length > 0) {
      select.value = cards[0].id;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    render,
    getDaysUntilDue,
    downloadCalendarReminder
  };
})();
