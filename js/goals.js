/**
 * FINANSY — GOALS MODULE (METAS DE AHORRO)
 * Visualización, aportes inteligentes y ciclo de vida de metas financieras.
 */

const FinanGoals = (() => {

  function render(state) {
    const { formatMoney } = FinanStore;
    const goals = state.goals || [];

    const badgeEl = document.getElementById('goals-count-badge');
    if (badgeEl) badgeEl.textContent = goals.length;

    const gridContainer = document.getElementById('goals-grid-container');
    const emptyState = document.getElementById('goals-empty-state');

    if (!gridContainer) return;

    if (goals.length === 0) {
      gridContainer.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    gridContainer.innerHTML = goals.map(goal => {
      const target = Number(goal.target) || 1;
      const current = Math.min(target, Math.max(0, Number(goal.current) || 0));
      const percent = Math.min(100, Math.round((current / target) * 100));
      const isCompleted = percent >= 100;
      const remaining = Math.max(0, target - current);

      return `
        <div class="goal-card ${isCompleted ? 'goal-card-completed' : ''}" data-goal-id="${goal.id}">
          <div class="goal-card-top">
            <div class="goal-title-wrap">
              <div class="goal-emoji-icon">${goal.emoji || '🎯'}</div>
              <div class="goal-info-title">
                <h4>${escapeHtml(goal.name)}</h4>
                <span class="text-subtle ${isCompleted ? 'text-emerald' : ''}">
                  ${isCompleted ? '🎉 ¡Meta Cumplida con Éxito!' : `Faltan ${formatMoney(remaining)}`}
                </span>
              </div>
            </div>
            <span class="goal-percentage-pill ${isCompleted ? 'pill-paid text-emerald' : ''}">${percent}%</span>
          </div>

          <div class="goal-amounts-row">
            <div>
              <span class="text-subtle" style="font-size: 0.75rem;">Ahorrado en esta meta</span>
              <div class="goal-curr-amount ${isCompleted ? 'text-emerald' : ''}">${formatMoney(current)}</div>
            </div>
            <div class="goal-target-amount">
              Meta: <strong>${formatMoney(target)}</strong>
            </div>
          </div>

          <div class="progress-bar-bg" style="height: 10px; border-radius: 999px;">
            <div class="progress-bar-fill ${isCompleted ? 'fill-emerald' : 'fill-cyan'}" style="width: ${percent}%;"></div>
          </div>

          <div class="goal-actions">
            ${!isCompleted ? `
              <button class="btn-xs btn-outline" data-deposit-goal="${goal.id}" data-amount="20000" title="Abonar $20.000">+ $20k</button>
              <button class="btn-xs btn-outline" data-deposit-goal="${goal.id}" data-amount="50000" title="Abonar $50.000">+ $50k</button>
              ${remaining <= 100000 ? `<button class="btn-xs btn-primary" data-deposit-goal="${goal.id}" data-amount="${remaining}" title="Completar el 100% de la meta">⚡ Completar</button>` : ''}
              <button class="btn-xs btn-ghost" data-custom-deposit-goal="${goal.id}" title="Ingresar monto personalizado">✏️ Otro</button>
            ` : `
              <span class="badge-completed-meta">🏆 Objetivo 100% Alcanzado</span>
            `}
            <button class="btn-xs btn-ghost" data-delete-goal="${goal.id}" title="Eliminar meta" style="max-width: 38px; margin-left: auto;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Event handlers para abonos
    gridContainer.querySelectorAll('[data-deposit-goal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-deposit-goal');
        const amount = Number(btn.getAttribute('data-amount')) || 0;
        const goal = (FinanStore.getState().goals || []).find(g => g.id === id);
        if (!goal) return;

        const remaining = Math.max(0, goal.target - goal.current);
        const depositAmount = Math.min(remaining, amount);
        
        if (depositAmount <= 0) {
          FinanApp.showToast('¡Esta meta ya está completada!', 'info');
          return;
        }

        FinanStore.updateGoalAmount(id, depositAmount);
        FinanApp.showToast(`¡Abonaste ${formatMoney(depositAmount)} a tu meta "${goal.name}"!`, 'success');
      });
    });

    // Abono personalizado
    gridContainer.querySelectorAll('[data-custom-deposit-goal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-custom-deposit-goal');
        const goal = (FinanStore.getState().goals || []).find(g => g.id === id);
        if (!goal) return;

        const remaining = Math.max(0, goal.target - goal.current);
        const valStr = prompt(`Ingresa el monto a abonar a "${goal.name}" (Faltan ${formatMoney(remaining)}):`, remaining > 0 ? remaining : '');
        if (valStr !== null && valStr.trim() !== '') {
          const rawNum = Number(valStr.replace(/[^0-9]/g, '')) || 0;
          if (rawNum > 0) {
            const finalDeposit = Math.min(remaining, rawNum);
            FinanStore.updateGoalAmount(id, finalDeposit);
            FinanApp.showToast(`¡Abonaste ${formatMoney(finalDeposit)} a "${goal.name}"!`, 'success');
          }
        }
      });
    });

    // Eliminación de meta con opción de transferir fondos a la Jarra activa
    gridContainer.querySelectorAll('[data-delete-goal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-goal');
        const goal = (FinanStore.getState().goals || []).find(g => g.id === id);
        if (!goal) return;

        if (goal.current > 0) {
          const shouldTransfer = confirm(
            `La meta "${goal.name}" tiene ${formatMoney(goal.current)} acumulados.\n\n¿Deseas transferir estos fondos a tu jarra de ahorro activa para conservar tu patrimonio ahorrado?\n\n- [Aceptar]: Transferir a tu Jarra de Ahorro y eliminar.\n- [Cancelar]: Descartar sin transferir.`
          );
          FinanStore.deleteGoal(id, shouldTransfer);
          if (shouldTransfer) {
            FinanApp.showToast(`Meta eliminada. ${formatMoney(goal.current)} transferidos a tu Jarra Activa.`, 'success');
          } else {
            FinanApp.showToast('Meta eliminada.', 'info');
          }
        } else {
          if (confirm(`¿Eliminar la meta "${goal.name}"?`)) {
            FinanStore.deleteGoal(id, false);
            FinanApp.showToast('Meta eliminada', 'info');
          }
        }
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
