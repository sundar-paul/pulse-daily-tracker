const STORAGE_KEY = 'pulse_tracker_backup_v1';

export const EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', color: '#f59e0b', icon: '🍽️' },
  { name: 'Groceries', color: '#22c55e', icon: '🛒' },
  { name: 'Transport', color: '#3b82f6', icon: '🚌' },
  { name: 'Bills & Utilities', color: '#a855f7', icon: '⚡' },
  { name: 'Shopping', color: '#ec4899', icon: '🛍️' },
  { name: 'Health', color: '#06b6d4', icon: '💊' },
  { name: 'Entertainment', color: '#f43f5e', icon: '🎬' },
  { name: 'Other', color: '#94a3b8', icon: '📦' },
];

export function getCategoryMeta(name) {
  return EXPENSE_CATEGORIES.find((c) => c.name === name) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}

export function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Local date string YYYY-MM-DD (avoids UTC timezone shifts)
export function toDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateStr(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr, delta) {
  const dt = parseDateStr(dateStr);
  dt.setDate(dt.getDate() + delta);
  return toDateStr(dt);
}

export function formatShortDay(dateStr) {
  const dt = parseDateStr(dateStr);
  return dt.toLocaleDateString(undefined, { weekday: 'short' });
}

export function formatMonthDay(dateStr) {
  const dt = parseDateStr(dateStr);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatFullDate(dateStr) {
  const dt = parseDateStr(dateStr);
  return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatCurrency(amount, currency = '₹') {
  const num = Number(amount) || 0;
  const formatted = num.toLocaleString(undefined, {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${currency}${formatted}`;
}

export function getDateRange(endDateStr, count) {
  const dates = [];
  for (let i = count - 1; i >= 0; i--) {
    dates.push(addDays(endDateStr, -i));
  }
  return dates;
}

export function createEmptyState(currency = '₹', monthlyBudget = 20000) {
  return {
    version: 1,
    meta: { isDemo: false },
    settings: { currency, monthlyBudget },
    recurringTasks: [],
    dismissedRecurring: {},
    tasks: [],
    expenses: [],
  };
}

export function createDemoState() {
  const today = toDateStr();
  const recurring = [
    { id: 'rec_1', title: 'Morning review & standup', priority: 'routine' },
    { id: 'rec_2', title: '30-min workout or walk', priority: 'routine' },
  ];

  const sampleTaskPool = [
    'Design analytics vector charts',
    'Refactor state components',
    'Review pull requests',
    'Update project documentation',
    'Read 20 pages of a book',
    'Clean up inbox & notes',
    'Prepare weekly summary',
    'Plan tomorrow priorities',
  ];

  const sampleExpensePool = [
    { title: 'Lunch bowl & coffee', category: 'Food & Dining', min: 180, max: 420, payment: 'UPI' },
    { title: 'Evening snacks & tea', category: 'Food & Dining', min: 60, max: 160, payment: 'UPI' },
    { title: 'Metro / cab commute', category: 'Transport', min: 90, max: 320, payment: 'UPI' },
    { title: 'Fresh vegetables & milk', category: 'Groceries', min: 220, max: 650, payment: 'UPI' },
    { title: 'Supermarket essentials', category: 'Groceries', min: 450, max: 1200, payment: 'Card' },
    { title: 'Internet & mobile bill', category: 'Bills & Utilities', min: 799, max: 1299, payment: 'Bank' },
    { title: 'Electricity bill', category: 'Bills & Utilities', min: 1450, max: 1900, payment: 'UPI' },
    { title: 'Pharmacy & vitamins', category: 'Health', min: 180, max: 520, payment: 'Card' },
    { title: 'Movie / streaming', category: 'Entertainment', min: 299, max: 650, payment: 'Card' },
    { title: 'Desk accessory', category: 'Shopping', min: 450, max: 1400, payment: 'Card' },
  ];

  const tasks = [];
  const expenses = [];

  // Deterministic pseudo-random so demo looks balanced & realistic
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let offset = 29; offset >= 0; offset--) {
    const d = addDays(today, -offset);
    const isToday = offset === 0;

    // Add recurring tasks
    for (const r of recurring) {
      const done = isToday ? r.id === 'rec_1' : rand() > 0.22;
      tasks.push({
        id: uid(),
        date: d,
        title: r.title,
        completed: done,
        priority: r.priority,
        recurringId: r.id,
      });
    }

    // Add 2 to 4 daily tasks
    const extraCount = isToday ? 3 : 2 + Math.floor(rand() * 3);
    const completionBias = offset === 2 || offset === 5 ? 1.0 : 0.68; // some 100% days
    for (let i = 0; i < extraCount; i++) {
      const title = sampleTaskPool[(offset + i * 3) % sampleTaskPool.length];
      const completed = isToday ? i === 2 : rand() < completionBias;
      tasks.push({
        id: uid(),
        date: d,
        title,
        completed,
        priority: i === 0 ? 'high' : 'normal',
        recurringId: null,
      });
    }

    // Add 1 to 3 daily expenses
    const expCount = isToday ? 2 : 1 + Math.floor(rand() * 3);
    for (let j = 0; j < expCount; j++) {
      // Bills only occasionally
      let item = sampleExpensePool[Math.floor(rand() * sampleExpensePool.length)];
      if (item.category === 'Bills & Utilities' && offset % 11 !== 0) {
        item = sampleExpensePool[j % 4];
      }
      const amt = Math.round((item.min + rand() * (item.max - item.min)) / 10) * 10;
      expenses.push({
        id: uid(),
        date: d,
        title: item.title,
        amount: amt,
        category: item.category,
        payment: item.payment,
      });
    }
  }

  return {
    version: 1,
    meta: { isDemo: true },
    settings: { currency: '₹', monthlyBudget: 25000 },
    recurringTasks: recurring,
    dismissedRecurring: {},
    tasks,
    expenses,
  };
}

export class TrackerStore {
  constructor() {
    this.state = createEmptyState();
    this.saveTimer = null;
    this.onSyncStatus = null;
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    this.useLocalApi = host === '127.0.0.1' || host === 'localhost';
  }

  async load() {
    let loaded = null;
    if (this.useLocalApi) {
      try {
        const res = await fetch('/api/data', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.exists && json.data) {
            loaded = json.data;
          }
        } else {
          this.useLocalApi = false;
        }
      } catch {
        this.useLocalApi = false;
      }
    }

    if (!loaded) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) loaded = JSON.parse(raw);
      } catch {
        // ignore
      }
    }

    if (loaded && typeof loaded === 'object') {
      this.state = {
        ...createEmptyState(),
        ...loaded,
        settings: { ...createEmptyState().settings, ...(loaded.settings || {}) },
        meta: { ...createEmptyState().meta, ...(loaded.meta || {}) },
        dismissedRecurring: loaded.dismissedRecurring || {},
      };
    } else {
      // First run: populate demo data so dashboard shines immediately
      this.state = createDemoState();
      await this.saveNow();
    }

    if (this.onSyncStatus) {
      this.onSyncStatus(this.useLocalApi ? 'saved' : 'local');
    }

    this.ensureRecurringForDate(toDateStr());
    return this.state;
  }

  scheduleSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // ignore quota
    }
    if (!this.useLocalApi) {
      if (this.onSyncStatus) this.onSyncStatus('local');
      return;
    }
    if (this.onSyncStatus) this.onSyncStatus('saving');
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 250);
  }

  async saveNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // ignore
    }
    if (!this.useLocalApi) {
      if (this.onSyncStatus) this.onSyncStatus('local');
      return;
    }
    try {
      const res = await fetch('/api/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.state),
      });
      if (res.ok && this.onSyncStatus) {
        this.onSyncStatus('saved');
      }
    } catch {
      this.useLocalApi = false;
      if (this.onSyncStatus) this.onSyncStatus('local');
    }
  }

  ensureRecurringForDate(dateStr) {
    if (!this.state.recurringTasks.length) return false;
    const today = toDateStr();
    // Only auto-populate for today or future dates so we don't mutate historical stats unexpectedly
    if (dateStr < today) return false;

    const dismissed = this.state.dismissedRecurring[dateStr] || [];
    const existingIds = new Set(
      this.state.tasks.filter((t) => t.date === dateStr && t.recurringId).map((t) => t.recurringId)
    );

    let changed = false;
    for (const r of this.state.recurringTasks) {
      if (!existingIds.has(r.id) && !dismissed.includes(r.id)) {
        this.state.tasks.push({
          id: uid(),
          date: dateStr,
          title: r.title,
          completed: false,
          priority: r.priority || 'routine',
          recurringId: r.id,
        });
        changed = true;
      }
    }
    if (changed) this.scheduleSave();
    return changed;
  }

  // ---- Task Mutations ----
  addTask({ date, title, priority = 'normal', recurring = false }) {
    const cleanTitle = title.trim();
    if (!cleanTitle) return null;

    let recurringId = null;
    if (recurring) {
      recurringId = uid();
      this.state.recurringTasks.push({ id: recurringId, title: cleanTitle, priority });
    }

    const task = {
      id: uid(),
      date,
      title: cleanTitle,
      completed: false,
      priority,
      recurringId,
    };
    this.state.tasks.unshift(task);
    this.scheduleSave();
    return task;
  }

  toggleTask(taskId) {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    task.completed = !task.completed;
    this.scheduleSave();
  }

  deleteTask(taskId) {
    const idx = this.state.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return;
    const [removed] = this.state.tasks.splice(idx, 1);
    if (removed.recurringId) {
      if (!this.state.dismissedRecurring[removed.date]) {
        this.state.dismissedRecurring[removed.date] = [];
      }
      this.state.dismissedRecurring[removed.date].push(removed.recurringId);
    }
    this.scheduleSave();
  }

  deleteRecurringTemplate(recurringId) {
    this.state.recurringTasks = this.state.recurringTasks.filter((r) => r.id !== recurringId);
    this.scheduleSave();
  }

  // ---- Expense Mutations ----
  addExpense({ date, title, amount, category, payment = 'UPI' }) {
    const num = Number(amount);
    if (!title.trim() || !(num > 0)) return null;
    const exp = {
      id: uid(),
      date,
      title: title.trim(),
      amount: Math.round(num * 100) / 100,
      category: category || 'Other',
      payment,
    };
    this.state.expenses.unshift(exp);
    this.scheduleSave();
    return exp;
  }

  deleteExpense(expenseId) {
    this.state.expenses = this.state.expenses.filter((e) => e.id !== expenseId);
    this.scheduleSave();
  }

  // ---- Settings & Data Management ----
  updateSettings({ currency, monthlyBudget }) {
    if (currency) this.state.settings.currency = currency;
    if (monthlyBudget !== undefined) {
      this.state.settings.monthlyBudget = Math.max(0, Number(monthlyBudget) || 0);
    }
    this.scheduleSave();
  }

  clearAllData() {
    const { currency, monthlyBudget } = this.state.settings;
    this.state = createEmptyState(currency, monthlyBudget);
    this.saveNow();
  }

  loadDemoData() {
    this.state = createDemoState();
    this.saveNow();
  }

  importData(parsed) {
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.expenses)) {
      throw new Error('Invalid backup file format.');
    }
    this.state = {
      ...createEmptyState(),
      ...parsed,
      meta: { ...(parsed.meta || {}), isDemo: false },
      settings: { ...createEmptyState().settings, ...(parsed.settings || {}) },
    };
    this.saveNow();
  }

  // ---- Analytics Queries ----
  getTasksForDate(dateStr) {
    return this.state.tasks.filter((t) => t.date === dateStr);
  }

  getTaskDayStats(dateStr) {
    const list = this.getTasksForDate(dateStr);
    const total = list.length;
    const completed = list.filter((t) => t.completed).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { date: dateStr, total, completed, rate };
  }

  getTaskAnalytics(endDateStr, period = 'weekly') {
    const daysCount = period === 'monthly' ? 30 : 7;
    const dates = getDateRange(endDateStr, daysCount);
    const series = dates.map((d) => this.getTaskDayStats(d));

    const totalCompleted = series.reduce((acc, s) => acc + s.completed, 0);
    const activeDays = series.filter((s) => s.total > 0);
    const avgRate = activeDays.length
      ? Math.round(activeDays.reduce((acc, s) => acc + s.rate, 0) / activeDays.length)
      : 0;

    // Perfect streak (consecutive days with 100% completion ending at endDateStr)
    let perfectStreak = 0;
    let cursor = endDateStr;
    for (let i = 0; i < 365; i++) {
      const st = this.getTaskDayStats(cursor);
      if (st.total > 0 && st.completed === st.total) {
        perfectStreak++;
        cursor = addDays(cursor, -1);
      } else {
        break;
      }
    }

    // Best streak in last 60 days
    const last60 = getDateRange(endDateStr, 60);
    let bestStreak = 0;
    let running = 0;
    for (const d of last60) {
      const st = this.getTaskDayStats(d);
      if (st.total > 0 && st.completed === st.total) {
        running++;
        if (running > bestStreak) bestStreak = running;
      } else {
        running = 0;
      }
    }

    const selectedDay = this.getTaskDayStats(endDateStr);
    const allTimeDone = this.state.tasks.filter((t) => t.completed).length;

    return {
      period,
      daysCount,
      series,
      selectedDay,
      totalCompleted,
      avgRate,
      perfectStreak,
      bestStreak,
      allTimeDone,
    };
  }

  getExpenseAnalytics(endDateStr, period = 'weekly') {
    const daysCount = period === 'monthly' ? 30 : 7;
    const dates = getDateRange(endDateStr, daysCount);
    const dateSet = new Set(dates);

    const byDate = {};
    for (const d of dates) byDate[d] = { date: d, total: 0, count: 0 };

    const periodExpenses = [];
    const catTotals = {};

    const monthPrefix = endDateStr.slice(0, 7); // YYYY-MM
    let monthSpend = 0;

    for (const e of this.state.expenses) {
      const amt = Number(e.amount) || 0;
      if (e.date.startsWith(monthPrefix)) {
        monthSpend += amt;
      }
      if (dateSet.has(e.date)) {
        periodExpenses.push(e);
        byDate[e.date].total += amt;
        byDate[e.date].count += 1;
        catTotals[e.category] = (catTotals[e.category] || 0) + amt;
      }
    }

    const series = dates.map((d) => ({
      date: d,
      total: Math.round(byDate[d].total * 100) / 100,
      count: byDate[d].count,
    }));

    const totalSpend = series.reduce((acc, s) => acc + s.total, 0);
    const dailyAvg = totalSpend / daysCount;
    const selectedDay = byDate[endDateStr] || { date: endDateStr, total: 0, count: 0 };

    let peakDay = series[0] || { date: endDateStr, total: 0 };
    for (const s of series) {
      if (s.total > peakDay.total) peakDay = s;
    }

    const categoryBreakdown = Object.entries(catTotals)
      .map(([name, amount]) => ({
        name,
        amount: Math.round(amount * 100) / 100,
        pct: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
        ...getCategoryMeta(name),
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      period,
      daysCount,
      series,
      periodExpenses,
      totalSpend: Math.round(totalSpend * 100) / 100,
      dailyAvg: Math.round(dailyAvg * 100) / 100,
      selectedDay,
      monthSpend: Math.round(monthSpend * 100) / 100,
      peakDay,
      categoryBreakdown,
    };
  }
}
