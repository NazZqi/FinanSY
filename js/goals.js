/**
 * FINANSY — GOALS MODULE (METAS DE AHORRO)
 * Visualización, aportes y seguimiento de metas financieras.
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
      const percent = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
      const isCompleted = percent >= 100;

      return `
        <div class="goal-card" data-goal-id="${goal.id}">
          <div class="goal-card-top">
            <div class="goal-title-wrap">
              <div class="goal-emoji-icon">${goal.emoji || '🎯'}</div>
              <div class="goal-info-title">
                <h4>${escapeHtml(goal.name)}</h4>
                <span class="text-subtle">${isCompleted ? '¡Meta Cumplida! 🎉' : `Faltan ${formatMoney(Math.max(0, goal.target - goal.current))}`}</span>
              </div>
            </div>
            <span class="goal-percentage-pill ${isCompleted ? 'text-emerald' : ''}">${percent}%</span>
          </div>

          <div class="goal-amounts-row">
            <div>
              <span class="text-subtle" style="font-size: 0.75rem;">Ahorrado</span>
              <div class="goal-curr-amount">${formatMoney(goal.current)}</div>
            </div>
            <div class="goal-target-amount">
              Meta: <strong>${formatMoney(goal.target)}</strong>
            </div>
          </div>

          <div class="progress-bar-bg" style="height: 10px;">
            <div class="progress-bar-fill ${isCompleted ? 'fill-emerald' : 'fill-cyan'}" style="width: ${percent}%;"></div>
          </div>

          <div class="goal-actions">
            <button class="btn-xs btn-outline" data-deposit-goal="${goal.id}" data-amount="20000" title="Abonar $20.000">+ $20k</button>
            <button class="btn-xs btn-outline" data-deposit-goal="${goal.id}" data-amount="50000" title="Abonar $50.000">+ $50k</button>
            <button class="btn-xs btn-ghost" data-delete-goal="${goal.id}" title="Eliminar meta" style="max-width: 38px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Event handlers
    gridContainer.querySelectorAll('[data-deposit-goal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-deposit-goal');
        const amount = Number(btn.getAttribute('data-amount')) || 0;
        FinanStore.updateGoalAmount(id, amount);
        FinanStore.depositSavings(amount); // Aumenta también el saldo de la jarra
        FinanApp.showToast(`¡Abonaste ${formatMoney(amount)} a tu meta!`, 'success');
      });
    });

    gridContainer.querySelectorAll('[data-delete-goal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-delete-goal');
        FinanStore.deleteGoal(id);
        FinanApp.showToast('Meta eliminada', 'info');
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
