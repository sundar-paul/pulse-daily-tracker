import {
  TrackerStore,
  EXPENSE_CATEGORIES,
  getCategoryMeta,
  toDateStr,
  addDays,
  formatShortDay,
  formatMonthDay,
  formatFullDate,
  formatCurrency,
  getDateRange,
} from './store.js';
import {
  renderTaskBarChart,
  renderExpenseBarChart,
  renderCategoryBreakdown,
} from './charts.js';

const store = new TrackerStore();

const ui = {
  view: 'dashboard',
  period: 'weekly', // 'weekly' | 'monthly'
  selectedDate: toDateStr(),
  taskFilter: 'all', // 'all' | 'pending' | 'completed'
  expSearch: '',
  expFilterCat: 'all',
  expFilterRange: 'period',
};

// ==================== HELPERS ====================
const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function toast(msg) {
  const container = $('toast-container');
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = msg;
  container.appendChild(node);
  setTimeout(() => node.remove(), 2600);
}

// Tooltip helpers
const tooltipEl = $('chart-tooltip');
function showTooltip(ev, html) {
  if (html !== undefined) tooltipEl.innerHTML = html;
  tooltipEl.classList.remove('hidden');
  const offset = 14;
  let x = ev.clientX + offset;
  let y = ev.clientY - 12;
  const rect = tooltipEl.getBoundingClientRect();
  if (x + rect.width > window.innerWidth - 10) x = ev.clientX - rect.width - offset;
  if (y + rect.height > window.innerHeight - 10) y = window.innerHeight - rect.height - 10;
  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${y}px`;
}

function hideTooltip() {
  tooltipEl.classList.add('hidden');
}

function setSelectedDate(dateStr) {
  if (!dateStr) return;
  ui.selectedDate = dateStr;
  store.ensureRecurringForDate(dateStr);
  $('active-date-input').value = dateStr;
  $('exp-date').value = dateStr;
  $('m-exp-date').value = dateStr;
  renderAll();
}

function switchView(viewName) {
  ui.view = viewName;
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  document.querySelectorAll('.view').forEach((sec) => {
    sec.classList.toggle('active', sec.id === `view-${viewName}`);
  });

  const titles = {
    dashboard: ['Overview Dashboard', 'Your daily productivity & spending at a glance'],
    tasks: ['Daily Tasks & Habits', 'Track completion rates, streaks, and daily routines'],
    expenses: ['Expense Tracker', 'Log daily spending and monitor category & budget analytics'],
  };
  const [title, sub] = titles[viewName] || titles.dashboard;
  $('page-title').textContent = title;
  $('page-subtitle').textContent = sub;
  renderAll();
}

// ==================== POPULATE SELECTS ====================
function populateCategorySelects() {
  const selects = [$('exp-category'), $('m-exp-category')];
  for (const sel of selects) {
    sel.innerHTML = EXPENSE_CATEGORIES.map(
      (c) => `<option value="${escapeHtml(c.name)}">${c.icon} ${escapeHtml(c.name)}</option>`
    ).join('');
  }
  $('exp-filter-cat').innerHTML =
    `<option value="all">All Categories</option>` +
    EXPENSE_CATEGORIES.map(
      (c) => `<option value="${escapeHtml(c.name)}">${c.icon} ${escapeHtml(c.name)}</option>`
    ).join('');
}

// ==================== RENDER TASK LIST ====================
function renderTaskItems(ulEl, tasks, { showBadges = false } = {}) {
  ulEl.innerHTML = '';
  if (!tasks.length) {
    ulEl.innerHTML = `<li class="empty-state">No tasks for this view. Add one above!</li>`;
    return;
  }

  for (const t of tasks) {
    const li = document.createElement('li');
    li.className = `task-item${t.completed ? ' completed' : ''}`;

    const badgeHtml =
      showBadges && t.priority === 'high'
        ? `<span class="task-badge badge-high">High</span>`
        : showBadges && t.priority === 'routine'
        ? `<span class="task-badge badge-routine">Daily</span>`
        : '';

    li.innerHTML = `
      <button class="task-check" data-toggle="${t.id}" aria-label="Toggle task completion">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </button>
      <span class="task-title">${escapeHtml(t.title)}</span>
      ${badgeHtml}
      <button class="icon-btn task-delete" data-delete="${t.id}" title="Delete task" aria-label="Delete task">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
        </svg>
      </button>
    `;
    ulEl.appendChild(li);
  }
}

// ==================== RENDER ALL VIEWS ====================
function renderAll() {
  const { currency, monthlyBudget } = store.state.settings;
  const periodLabel = ui.period === 'monthly' ? '30-Day' : '7-Day';
  const taskStats = store.getTaskAnalytics(ui.selectedDate, ui.period);
  const expStats = store.getExpenseAnalytics(ui.selectedDate, ui.period);

  // Demo banner
  $('demo-banner').classList.toggle('hidden', !store.state.meta?.isDemo);

  // Sidebar badge (pending tasks on selected date)
  const pendingCount = taskStats.selectedDay.total - taskStats.selectedDay.completed;
  $('nav-tasks-badge').textContent = String(pendingCount);

  // ---- DASHBOARD VIEW ----
  $('kpi-today-rate').textContent = `${taskStats.selectedDay.rate}%`;
  $('kpi-rate-tag').textContent = `${taskStats.selectedDay.completed}/${taskStats.selectedDay.total} done`;
  $('kpi-rate-sub').textContent =
    taskStats.selectedDay.total === 0
      ? 'No tasks added for this day'
      : pendingCount === 0
      ? 'All tasks completed!'
      : `${pendingCount} task${pendingCount > 1 ? 's' : ''} remaining`;

  $('kpi-finished-label').textContent = `${periodLabel} Finished`;
  $('kpi-period-finished').textContent = `${taskStats.totalCompleted} items`;
  $('kpi-streak-tag').textContent = `${taskStats.perfectStreak}d streak`;
  $('kpi-avg-rate-sub').textContent = `Avg completion: ${taskStats.avgRate}%`;

  $('kpi-spend-label').textContent = `${periodLabel} Spending`;
  $('kpi-period-spend').textContent = formatCurrency(expStats.totalSpend, currency);
  $('kpi-today-spend-tag').textContent = `Day: ${formatCurrency(expStats.selectedDay.total, currency)}`;
  $('kpi-daily-avg-sub').textContent = `Daily avg: ${formatCurrency(expStats.dailyAvg, currency)}`;

  $('kpi-month-spend').textContent = formatCurrency(expStats.monthSpend, currency);
  if (monthlyBudget > 0) {
    const pct = Math.round((expStats.monthSpend / monthlyBudget) * 100);
    const barEl = $('kpi-budget-bar');
    barEl.style.width = `${Math.min(100, pct)}%`;
    barEl.classList.toggle('over-budget', pct > 90);
    const pctTag = $('kpi-budget-pct');
    pctTag.textContent = `${pct}% used`;
    pctTag.className = `kpi-tag ${pct > 100 ? 'tag-red' : pct > 80 ? 'tag-amber' : 'tag-purple'}`;
    const rem = monthlyBudget - expStats.monthSpend;
    $('kpi-budget-sub').textContent =
      rem >= 0
        ? `${formatCurrency(rem, currency)} left of ${formatCurrency(monthlyBudget, currency)}`
        : `Over budget by ${formatCurrency(Math.abs(rem), currency)}`;
  } else {
    $('kpi-budget-bar').style.width = '0%';
    $('kpi-budget-pct').textContent = 'No limit';
    $('kpi-budget-sub').textContent = 'Set a monthly budget in Settings';
  }

  // Dashboard Task Chart
  $('dash-task-chart-desc').textContent =
    ui.period === 'monthly' ? 'Last 30 days completion percentage' : 'Last 7 days completion percentage';
  $('strip-today-rate').textContent = `${taskStats.selectedDay.rate}%`;
  $('strip-finished-label').textContent = `${periodLabel} Finished`;
  $('strip-period-finished').textContent = `${taskStats.totalCompleted} items`;
  $('strip-perfect-streak').textContent = `${taskStats.perfectStreak} days`;

  renderTaskBarChart($('dash-task-chart'), taskStats.series, {
    selectedDate: ui.selectedDate,
    onSelectDate: setSelectedDate,
    showTooltip,
    hideTooltip,
  });

  // Dashboard Expense Chart
  $('dash-expense-chart-desc').textContent =
    ui.period === 'monthly' ? 'Daily spending over the last 30 days' : 'Daily spending over the last 7 days';
  $('strip-today-spend').textContent = formatCurrency(expStats.selectedDay.total, currency);
  $('strip-spend-label').textContent = `${periodLabel} Total`;
  $('strip-period-spend').textContent = formatCurrency(expStats.totalSpend, currency);
  $('strip-top-cat').textContent = expStats.categoryBreakdown[0]?.name || '—';

  renderExpenseBarChart($('dash-expense-chart'), expStats.series, {
    selectedDate: ui.selectedDate,
    currency,
    onSelectDate: setSelectedDate,
    showTooltip,
    hideTooltip,
  });

  // Dashboard Checklist
  const isToday = ui.selectedDate === toDateStr();
  $('dash-checklist-title').textContent = isToday
    ? "Today's Checklist"
    : `Checklist — ${formatMonthDay(ui.selectedDate)}`;
  $('dash-checklist-sub').textContent = `${taskStats.selectedDay.completed} of ${taskStats.selectedDay.total} completed`;
  renderTaskItems($('dash-task-list'), store.getTasksForDate(ui.selectedDate), { showBadges: true });

  // Dashboard Category Donut
  $('dash-cat-desc').textContent = `Spending share over the last ${ui.period === 'monthly' ? '30' : '7'} days`;
  renderCategoryBreakdown($('dash-category-donut'), $('dash-category-bars'), expStats.categoryBreakdown, {
    total: expStats.totalSpend,
    currency,
  });

  // ---- TASKS VIEW ----
  renderTasksView(taskStats);

  // ---- EXPENSES VIEW ----
  renderExpensesView(expStats, currency, monthlyBudget, periodLabel);
}

function renderTasksView(taskStats) {
  // 7-day strip ending on today (or centered near selected date)
  const stripEnd = ui.selectedDate > toDateStr() ? ui.selectedDate : toDateStr();
  const stripDates = getDateRange(stripEnd, 7);
  const stripEl = $('tasks-day-strip');
  stripEl.innerHTML = '';
  for (const d of stripDates) {
    const st = store.getTaskDayStats(d);
    const btn = document.createElement('button');
    btn.className = `day-card${d === ui.selectedDate ? ' active' : ''}`;
    btn.innerHTML = `
      <span class="day-card-dow">${formatShortDay(d)}</span>
      <span class="day-card-num">${Number(d.slice(8))}</span>
      <span class="day-card-rate">${st.total > 0 ? `${st.rate}%` : '—'}</span>
    `;
    btn.addEventListener('click', () => setSelectedDate(d));
    stripEl.appendChild(btn);
  }

  $('tasks-view-date-title').textContent = formatFullDate(ui.selectedDate);
  $('tasks-view-progress').textContent = `${taskStats.selectedDay.completed} of ${taskStats.selectedDay.total} tasks completed (${taskStats.selectedDay.rate}%)`;

  let dayTasks = store.getTasksForDate(ui.selectedDate);
  if (ui.taskFilter === 'pending') dayTasks = dayTasks.filter((t) => !t.completed);
  if (ui.taskFilter === 'completed') dayTasks = dayTasks.filter((t) => t.completed);
  renderTaskItems($('full-task-list'), dayTasks, { showBadges: true });

  // Recurring templates
  const recs = store.state.recurringTasks;
  $('recurring-count').textContent = `${recs.length} active`;
  const chipsEl = $('recurring-chips');
  if (!recs.length) {
    chipsEl.innerHTML = `<span class="muted-text">No recurring tasks yet. Check "Repeat daily" when adding a task.</span>`;
  } else {
    chipsEl.innerHTML = recs
      .map(
        (r) => `<span class="r-chip">${escapeHtml(r.title)} <button data-del-rec="${r.id}" title="Stop repeating">&times;</button></span>`
      )
      .join('');
  }

  // Tasks page chart & stats
  $('tasks-chart-desc').textContent =
    ui.period === 'monthly' ? '30-day completion trend' : '7-day completion trend';
  $('tasks-avg-rate').textContent = `${taskStats.avgRate}%`;
  $('tasks-best-streak').textContent = `${taskStats.bestStreak} days`;
  $('tasks-total-done').textContent = String(taskStats.allTimeDone);

  renderTaskBarChart($('tasks-page-chart'), taskStats.series, {
    selectedDate: ui.selectedDate,
    onSelectDate: setSelectedDate,
    showTooltip,
    hideTooltip,
  });

  // 30-day consistency heatmap
  const hmDates = getDateRange(toDateStr(), 30);
  const hmEl = $('tasks-heatmap');
  hmEl.innerHTML = '';
  for (const d of hmDates) {
    const st = store.getTaskDayStats(d);
    let lv = 0;
    if (st.total > 0 && st.rate > 0) {
      if (st.rate >= 100) lv = 4;
      else if (st.rate >= 70) lv = 3;
      else if (st.rate >= 40) lv = 2;
      else lv = 1;
    }
    const cell = document.createElement('div');
    cell.className = `hm-cell lv-${lv}${d === ui.selectedDate ? ' selected' : ''}`;
    cell.addEventListener('mouseenter', (ev) => {
      showTooltip(
        ev,
        `<div class="tt-title">${formatMonthDay(d)}</div>
         <div class="tt-row"><span>Rate</span><strong>${st.rate}%</strong></div>
         <div class="tt-row"><span>Done</span><strong>${st.completed}/${st.total}</strong></div>`
      );
    });
    cell.addEventListener('mousemove', (ev) => showTooltip(ev));
    cell.addEventListener('mouseleave', hideTooltip);
    cell.addEventListener('click', () => setSelectedDate(d));
    hmEl.appendChild(cell);
  }
}

function renderExpensesView(expStats, currency, monthlyBudget, periodLabel) {
  $('exp-kpi-today').textContent = formatCurrency(expStats.selectedDay.total, currency);
  $('exp-kpi-today-count').textContent = `${expStats.selectedDay.count} transaction${expStats.selectedDay.count === 1 ? '' : 's'}`;

  $('exp-kpi-period-label').textContent = `${periodLabel} Total`;
  $('exp-kpi-period').textContent = formatCurrency(expStats.totalSpend, currency);
  $('exp-kpi-period-avg').textContent = `Daily avg: ${formatCurrency(expStats.dailyAvg, currency)}`;

  $('exp-kpi-month').textContent = formatCurrency(expStats.monthSpend, currency);
  if (monthlyBudget > 0) {
    const rem = monthlyBudget - expStats.monthSpend;
    $('exp-kpi-month-rem').textContent =
      rem >= 0
        ? `${formatCurrency(rem, currency)} remaining`
        : `Over by ${formatCurrency(Math.abs(rem), currency)}`;
  } else {
    $('exp-kpi-month-rem').textContent = 'No budget set';
  }

  $('exp-kpi-peak').textContent = formatCurrency(expStats.peakDay?.total || 0, currency);
  $('exp-kpi-peak-date').textContent =
    expStats.peakDay?.total > 0 ? formatMonthDay(expStats.peakDay.date) : 'No spend yet';

  $('exp-chart-desc').textContent =
    ui.period === 'monthly' ? 'Daily expenses over the last 30 days' : 'Daily expenses over the last 7 days';
  renderExpenseBarChart($('expenses-page-chart'), expStats.series, {
    selectedDate: ui.selectedDate,
    currency,
    onSelectDate: setSelectedDate,
    showTooltip,
    hideTooltip,
  });

  renderCategoryBreakdown($('exp-category-donut'), $('exp-category-bars'), expStats.categoryBreakdown, {
    total: expStats.totalSpend,
    currency,
  });

  // Ledger filtering
  let list;
  if (ui.expFilterRange === 'day') {
    list = store.state.expenses.filter((e) => e.date === ui.selectedDate);
  } else if (ui.expFilterRange === 'all') {
    list = [...store.state.expenses];
  } else {
    list = [...expStats.periodExpenses];
  }

  if (ui.expFilterCat !== 'all') {
    list = list.filter((e) => e.category === ui.expFilterCat);
  }
  if (ui.expSearch.trim()) {
    const q = ui.expSearch.trim().toLowerCase();
    list = list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.payment || '').toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

  const totalFiltered = list.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  $('ledger-count-sub').textContent = `${list.length} entries · Total ${formatCurrency(totalFiltered, currency)}`;

  const ledgerEl = $('expense-ledger');
  ledgerEl.innerHTML = '';
  if (!list.length) {
    ledgerEl.innerHTML = `<div class="empty-state">No matching expenses found.</div>`;
    return;
  }

  for (const e of list) {
    const cat = getCategoryMeta(e.category);
    const row = document.createElement('div');
    row.className = 'ledger-item';
    row.innerHTML = `
      <div class="ledger-cat-pill" style="background:${cat.color}22;color:${cat.color}">${cat.icon}</div>
      <div class="ledger-info">
        <div class="ledger-title">${escapeHtml(e.title)}</div>
        <div class="ledger-meta">${formatMonthDay(e.date)} · ${escapeHtml(e.category)} · ${escapeHtml(e.payment || 'UPI')}</div>
      </div>
      <div class="ledger-amount">${formatCurrency(e.amount, currency)}</div>
      <button class="icon-btn task-delete" data-del-exp="${e.id}" title="Delete expense" aria-label="Delete expense">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
        </svg>
      </button>
    `;
    ledgerEl.appendChild(row);
  }
}

// ==================== EXPORT HELPERS ====================
function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExpensesCsv() {
  const header = ['Date', 'Title', 'Category', 'Payment', 'Amount'];
  const rows = store.state.expenses.map((e) => [
    e.date,
    `"${String(e.title).replaceAll('"', '""')}"`,
    `"${String(e.category).replaceAll('"', '""')}"`,
    `"${String(e.payment || '').replaceAll('"', '""')}"`,
    e.amount,
  ]);
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  downloadFile(`pulse-expenses-${toDateStr()}.csv`, csv, 'text/csv;charset=utf-8');
  toast('Exported expenses CSV');
}

// ==================== EVENT WIRING ====================
function bindEvents() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  document.querySelectorAll('[data-jump]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.jump));
  });

  // Period toggle
  document.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.period = btn.dataset.period;
      document.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
      renderAll();
    });
  });

  // Date navigation
  $('btn-prev-day').addEventListener('click', () => setSelectedDate(addDays(ui.selectedDate, -1)));
  $('btn-next-day').addEventListener('click', () => setSelectedDate(addDays(ui.selectedDate, 1)));
  $('btn-today').addEventListener('click', () => setSelectedDate(toDateStr()));
  $('active-date-input').addEventListener('change', (e) => {
    if (e.target.value) setSelectedDate(e.target.value);
  });

  // Dashboard quick add task
  $('dash-task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('dash-task-input');
    if (store.addTask({ date: ui.selectedDate, title: input.value })) {
      input.value = '';
      renderAll();
    }
  });

  // Full task form
  $('full-task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('full-task-input');
    const priority = $('full-task-priority').value;
    const recurring = $('full-task-recurring').checked;
    if (store.addTask({ date: ui.selectedDate, title: input.value, priority, recurring })) {
      input.value = '';
      $('full-task-recurring').checked = false;
      toast(recurring ? 'Added daily recurring task' : 'Task added');
      renderAll();
    }
  });

  // Task list click delegation (both dashboard & tasks view)
  for (const listId of ['dash-task-list', 'full-task-list']) {
    $(listId).addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('[data-toggle]');
      if (toggleBtn) {
        store.toggleTask(toggleBtn.dataset.toggle);
        renderAll();
        return;
      }
      const delBtn = e.target.closest('[data-delete]');
      if (delBtn) {
        store.deleteTask(delBtn.dataset.delete);
        renderAll();
      }
    });
  }

  // Task filter pills
  $('task-filter-pills').addEventListener('click', (e) => {
    const pill = e.target.closest('[data-filter]');
    if (!pill) return;
    ui.taskFilter = pill.dataset.filter;
    $('task-filter-pills').querySelectorAll('.pill').forEach((p) => p.classList.toggle('active', p === pill));
    renderAll();
  });

  // Recurring chip delete
  $('recurring-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del-rec]');
    if (!btn) return;
    store.deleteRecurringTemplate(btn.dataset.delRec);
    toast('Stopped repeating task');
    renderAll();
  });

  // Full expense form
  $('full-expense-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const added = store.addExpense({
      amount: $('exp-amount').value,
      title: $('exp-title').value,
      category: $('exp-category').value,
      payment: $('exp-payment').value,
      date: $('exp-date').value || ui.selectedDate,
    });
    if (added) {
      $('exp-amount').value = '';
      $('exp-title').value = '';
      toast(`Logged ${formatCurrency(added.amount, store.state.settings.currency)}`);
      renderAll();
    }
  });

  // Ledger delete & filters
  $('expense-ledger').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del-exp]');
    if (!btn) return;
    store.deleteExpense(btn.dataset.delExp);
    toast('Expense deleted');
    renderAll();
  });

  $('exp-search').addEventListener('input', (e) => {
    ui.expSearch = e.target.value;
    renderAll();
  });
  $('exp-filter-cat').addEventListener('change', (e) => {
    ui.expFilterCat = e.target.value;
    renderAll();
  });
  $('exp-filter-range').addEventListener('change', (e) => {
    ui.expFilterRange = e.target.value;
    renderAll();
  });

  // Modals
  $('btn-quick-expense').addEventListener('click', () => {
    $('m-exp-date').value = ui.selectedDate;
    $('modal-quick-expense').classList.remove('hidden');
    $('m-exp-amount').focus();
  });

  $('modal-expense-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const added = store.addExpense({
      amount: $('m-exp-amount').value,
      title: $('m-exp-title').value,
      category: $('m-exp-category').value,
      payment: $('m-exp-payment').value,
      date: $('m-exp-date').value || ui.selectedDate,
    });
    if (added) {
      $('m-exp-amount').value = '';
      $('m-exp-title').value = '';
      $('modal-quick-expense').classList.add('hidden');
      toast(`Logged ${formatCurrency(added.amount, store.state.settings.currency)}`);
      renderAll();
    }
  });

  $('btn-open-settings').addEventListener('click', () => {
    $('set-currency').value = store.state.settings.currency;
    $('set-budget').value = store.state.settings.monthlyBudget || '';
    $('modal-settings').classList.remove('hidden');
  });

  $('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    store.updateSettings({
      currency: $('set-currency').value,
      monthlyBudget: $('set-budget').value,
    });
    $('modal-settings').classList.add('hidden');
    toast('Preferences saved');
    renderAll();
  });

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      $(btn.dataset.closeModal).classList.add('hidden');
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach((bd) => {
    bd.addEventListener('click', (e) => {
      if (e.target === bd) bd.classList.add('hidden');
    });
  });

  // Backup / Demo / Reset
  $('btn-export-json').addEventListener('click', () => {
    downloadFile(`pulse-backup-${toDateStr()}.json`, JSON.stringify(store.state, null, 2), 'application/json');
    toast('JSON backup downloaded');
  });

  $('btn-export-csv').addEventListener('click', exportExpensesCsv);

  $('input-import-json').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      store.importData(JSON.parse(text));
      $('modal-settings').classList.add('hidden');
      toast('Backup imported successfully');
      renderAll();
    } catch (err) {
      toast(`Import failed: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  });

  $('btn-clear-demo').addEventListener('click', () => {
    store.clearAllData();
    toast('Sample data cleared — ready for your own entries!');
    renderAll();
  });

  $('btn-load-demo').addEventListener('click', () => {
    store.loadDemoData();
    $('modal-settings').classList.add('hidden');
    toast('Sample data loaded');
    renderAll();
  });

  $('btn-reset-all').addEventListener('click', () => {
    if (confirm('Clear all tasks and expenses? Consider exporting a JSON backup first.')) {
      store.clearAllData();
      $('modal-settings').classList.add('hidden');
      toast('All data cleared');
      renderAll();
    }
  });
}

// ==================== INIT ====================
async function init() {
  populateCategorySelects();
  bindEvents();

  store.onSyncStatus = (status) => {
    const label = $('sync-label');
    if (status === 'saving') label.textContent = 'Saving...';
    else if (status === 'saved') label.textContent = 'Saved to disk';
    else label.textContent = 'Saved in browser';
  };

  await store.load();
  $('active-date-input').value = ui.selectedDate;
  $('exp-date').value = ui.selectedDate;
  $('m-exp-date').value = ui.selectedDate;
  renderAll();
}

init();
