/* ============================================================
   MY PROJECT — Expense Tracker
   Step 3: Dashboard UI (theme, modal, history, filters)
   ============================================================ */

/* ============================================================
   THEME TOGGLE (Dark / Light)
   ============================================================ */
const themeToggle = document.getElementById('themeToggle');

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('expenseTheme', theme);
}

(function initTheme() {
    const saved = localStorage.getItem('expenseTheme');
    // Dark is the default; respect any previously saved theme preference.
    applyTheme(saved || 'dark');
})();

themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
    renderDoughnut();
});

/* ============================================================
   WORKER API
   ============================================================ */
const API_BASE = 'https://spendwise-worker.bossofficiel2-0.workers.dev/api';
const AUTH_TOKEN_KEY = 'spendwiseAuthToken';

function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function authFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = getAuthToken();

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(url, {
        ...options,
        headers
    });
}

/* ============================================================
   CATEGORIES (fixed)
   ============================================================ */
const CATEGORIES = {
    food:     { name: 'Food',         icon: '🍔', color: '#f97316' },
    travel:   { name: 'Travel',       icon: '🚗', color: '#3b82f6' },
    shopping: { name: 'Shopping',     icon: '🛒', color: '#ec4899' },
    bills:    { name: 'Bills',        icon: '🏠', color: '#8b5cf6' },
    health:   { name: 'Health',       icon: '💊', color: '#14b8a6' },
    education: { name: 'Education',   icon: '📚', color: '#06b6d4' },
    salary:   { name: 'Salary',       icon: '💰', color: '#10b981' },
    other:    { name: 'Other',        icon: '🎁', color: '#64748b' }
};

const EXPENSE_CATEGORIES = ['food', 'travel', 'shopping', 'bills', 'health', 'education', 'other'];
const INCOME_CATEGORIES = ['salary', 'other'];

/* ============================================================
   STATE + STORAGE
   ============================================================ */
const STORAGE_KEY = 'expenseTrackerData';
let transactions = [];

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (err) {
        console.error('Failed to save data:', err);
    }
}

function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        transactions = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(transactions)) transactions = [];
    } catch (err) {
        console.error('Failed to load data:', err);
        transactions = [];
    }
}

async function loadTransactionsFromAPI() {
    try {
        const response = await authFetch(`${API_BASE}/transactions`);
        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        transactions = Array.isArray(data.transactions) ? data.transactions : [];
        saveData();
        renderDashboard();
        console.log(`Loaded ${transactions.length} transaction(s) from Worker API.`);
    } catch (err) {
        console.error('Failed to load transactions from API:', err);
    }
}

/* ============================================================
   UI REFS
   ============================================================ */
const balanceValue = document.getElementById('balanceValue');
const incomeTotalEl = document.getElementById('incomeTotal');
const expenseTotalEl = document.getElementById('expenseTotal');
const monthIncomeEl = document.getElementById('monthIncome');
const monthExpenseEl = document.getElementById('monthExpense');
const monthSavingsEl = document.getElementById('monthSavings');
const todaySpendingEl = document.getElementById('todaySpending');
const monthLabelEl = document.getElementById('monthLabel');
const monthContextEl = document.getElementById('monthContext');
const txnListEl = document.getElementById('txnList');
const emptyStateEl = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const categoryFilter = document.getElementById('categoryFilter');
const resultsCountEl = document.getElementById('resultsCount');

// Chart refs
const categoryCanvas = document.getElementById('categoryChart');
const categoryLegendEl = document.getElementById('categoryLegend');
const categoryEmptyEl = document.getElementById('categoryEmpty');
const barChartEl = document.getElementById('barChart');
const barEmptyEl = document.getElementById('barEmpty');
const chartTooltipEl = document.getElementById('chartTooltip');
const chartMonthEl = document.getElementById('chartMonth');

/* ============================================================
   MODAL
   ============================================================ */
const modalOverlay = document.getElementById('modalOverlay');
const fabBtn = document.getElementById('fabBtn');
const modalClose = document.getElementById('modalClose');
const dateInput = document.getElementById('dateInput');

function openModal() {
    isSaving = false; // reset guard so a fresh transaction can always be saved
    const today = new Date();
    const local = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
    dateInput.value = local.toISOString().slice(0, 10);
    modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('amountInput').focus(), 120);
}

function closeModal() {
    modalOverlay.hidden = true;
    document.body.style.overflow = '';
}

fabBtn.addEventListener('click', openModal);
modalClose.addEventListener('click', closeModal);

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
});

/* ============================================================
   MONTH STATE
   ============================================================ */
const now = new Date();
let currentYear = now.getFullYear();
let currentMonth = now.getMonth(); // 0-11

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function updateMonthLabel() {
    monthLabelEl.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;
    const isCurrent = currentYear === now.getFullYear() && currentMonth === now.getMonth();
    monthContextEl.textContent = isCurrent
        ? 'Overview for this month'
        : 'Overview for the selected month';
}

/* ============================================================
   FORMATTING HELPERS
   ============================================================ */
function formatMoney(amount) {
    const n = Number(amount);
    if (isNaN(n)) return '₹0.00';
    return '₹' + n.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function todayKey() {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}

let selectedType = 'expense';

/* ============================================================
   CATEGORY SELECT + FILTER POPULATION
   ============================================================ */
function populateCategorySelect() {
    const select = document.getElementById('categorySelect');
    select.innerHTML = '';
    const list = selectedType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    list.forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${CATEGORIES[id].icon} ${CATEGORIES[id].name}`;
        select.appendChild(opt);
    });
}

function populateCategoryFilter() {
    categoryFilter.innerHTML = '';
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'All Categories';
    categoryFilter.appendChild(allOpt);
    Object.keys(CATEGORIES).forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${CATEGORIES[id].icon} ${CATEGORIES[id].name}`;
        categoryFilter.appendChild(opt);
    });
}

/* ============================================================
   FILTERS
   ============================================================ */
function getFilters() {
    return {
        search: searchInput.value.trim().toLowerCase(),
        type: typeFilter.value,
        category: categoryFilter.value
    };
}

function matchesFilters(txn, filters) {
    if (filters.type !== 'all' && txn.type !== filters.type) return false;
    if (filters.category !== 'all' && txn.category !== filters.category) return false;
    if (filters.search) {
        const catName = (CATEGORIES[txn.category]?.name || '').toLowerCase();
        const note = (txn.note || '').toLowerCase();
        if (!catName.includes(filters.search) && !note.includes(filters.search)) return false;
    }
    return true;
}

function filtersActive() {
    const f = getFilters();
    return f.search !== '' || f.type !== 'all' || f.category !== 'all';
}

function clearFilters() {
    searchInput.value = '';
    typeFilter.value = 'all';
    categoryFilter.value = 'all';
    // No renderHistory() here: the caller (clearFiltersBtn handler) runs
    // refreshViews() right after, which renders it once.
}

/* ============================================================
   TOTALS
   ============================================================ */
function getTotals(list) {
    let income = 0;
    let expense = 0;
    list.forEach(t => {
        const amount = Number(t.amount) || 0;
        if (t.type === 'income') income += amount;
        else expense += amount;
    });
    return { income, expense, balance: income - expense };
}

/* ============================================================
   CHARTS
   ============================================================ */
function getCtx(canvas) {
    return canvas && canvas.getContext ? canvas.getContext('2d') : null;
}

/* --- Doughnut chart: expenses by category --- */
let chartSegments = []; // {label, value, color, pct}

/**
 * Return the computed background of the nearest .chart-card ancestor, which
 * matches the current light/dark theme's --surface-2 value.  This is used
 * for the doughnut "hole" fill so it blends with the card background.
 */
function getHoleColor() {
    const card = categoryCanvas.closest('.chart-card');
    return (card && getComputedStyle(card).backgroundColor)
        || getComputedStyle(document.body).backgroundColor || '#fff';
}

function renderDoughnut() {
    const ctx = getCtx(categoryCanvas);
    if (!ctx) return;

    chartSegments = [];

    // Expenses scoped to the selected month
    const monthExpenses = transactions.filter(t => {
        if (t.type !== 'expense') return false;
        const [y, m] = t.date.split('-').map(Number);
        return y === currentYear && m === currentMonth + 1;
    });

    // Aggregate by category
    const byCat = {};
    let total = 0;
    monthExpenses.forEach(t => {
        const cat = t.category || 'other';
        byCat[cat] = (byCat[cat] || 0) + (Number(t.amount) || 0);
        total += Number(t.amount) || 0;
    });

    const catIds = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);

    categoryLegendEl.innerHTML = '';
    categoryEmptyEl.style.display = 'block';
    ctx.clearRect(0, 0, categoryCanvas.width, categoryCanvas.height);

    if (catIds.length === 0) {
        categoryCanvas.style.display = 'none';
        chartTooltipEl.hidden = true;
        return;
    }

    categoryCanvas.style.display = 'block';
    categoryEmptyEl.style.display = 'none';

    const size = categoryCanvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size * 0.42;
    const innerR = outerR * 0.58;

    let start = -Math.PI / 2;

    catIds.forEach((id, i) => {
        const cat = CATEGORIES[id] || CATEGORIES.other;
        const value = byCat[id];
        const sliceAngle = (value / total) * Math.PI * 2;
        const color = cat.color;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, start, start + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = 1;
        ctx.fill();

        chartSegments.push({
            id,
            label: cat.name,
            icon: cat.icon,
            color,
            value,
            pct: (value / total) * 100,
            startAngle: start,
            endAngle: start + sliceAngle
        });

        start += sliceAngle;
    });

    // Inner hole (doughnut) — drawn once after all slices so it covers the
    // centre and blends with the card background.
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = getHoleColor();
    ctx.fill();

    // Legend
    catIds.forEach((id, i) => {
        const cat = CATEGORIES[id] || CATEGORIES.other;
        const value = byCat[id];
        const pct = Math.round((value / total) * 100);

        const item = document.createElement('span');
        item.className = 'legend-item';

        const dot = document.createElement('span');
        dot.className = 'legend-dot';
        dot.style.background = cat.color;

        const name = document.createElement('span');
        name.textContent = `${cat.icon} ${cat.name}`;

        const pctEl = document.createElement('span');
        pctEl.className = 'legend-pct';
        pctEl.textContent = pct + '%';

        item.appendChild(dot);
        item.appendChild(name);
        item.appendChild(pctEl);
        categoryLegendEl.appendChild(item);
    });

    attachDoughnutHover();
}

/* --- Doughnut hover tooltip --- */
function attachDoughnutHover() {
    if (!categoryCanvas) return;
    const size = categoryCanvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size * 0.42;
    const innerR = outerR * 0.58;

    function handleMove(e) {
        if (chartSegments.length === 0) return;
        const rect = categoryCanvas.getBoundingClientRect();
        const scaleX = categoryCanvas.width / rect.width;
        const scaleY = categoryCanvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let angle = Math.atan2(dy, dx);
        if (angle < -Math.PI / 2) angle += Math.PI * 2;

        let found = null;
        if (dist >= innerR && dist <= outerR) {
            for (const seg of chartSegments) {
                const s = seg.startAngle;
                const en = seg.endAngle;
                if (angle >= s && angle <= en) { found = seg; break; }
            }
        }

        if (found) {
            chartTooltipEl.hidden = false;
            chartTooltipEl.textContent = `${found.icon} ${found.label}: ${formatMoney(found.value)} (${Math.round(found.pct)}%)`;
            // The tooltip is absolutely positioned inside .doughnut-wrap (its
            // containing block), so anchor it to pointer coords relative to the
            // wrap — not viewport coords — and clamp so it can't overflow it.
            const wrapRect = chartTooltipEl.parentElement.getBoundingClientRect();
            const wrapW = chartTooltipEl.parentElement.clientWidth || wrapRect.width;
            const tx = Math.max(6, Math.min(e.clientX - wrapRect.left, wrapW - 6));
            const ty = Math.max(26, e.clientY - wrapRect.top);
            chartTooltipEl.style.left = tx + 'px';
            chartTooltipEl.style.top = ty + 'px';
            categoryCanvas.style.cursor = 'pointer';
        } else {
            chartTooltipEl.hidden = true;
            categoryCanvas.style.cursor = 'default';
        }
    }

    function handleLeave() {
        chartTooltipEl.hidden = true;
    }

    categoryCanvas.onmousemove = handleMove;
    categoryCanvas.onmouseleave = handleLeave;
    categoryCanvas.ontouchstart = (e) => {
        const touch = e.touches[0];
        handleMove({ clientX: touch.clientX, clientY: touch.clientY });
    };
    categoryCanvas.ontouchend = handleLeave;
}

/* --- 7-day bar chart: income vs expense --- */
function renderBarChart() {
    barChartEl.innerHTML = '';
    barEmptyEl.style.display = 'block';

    const days = [];
    const today = new Date();
    const todayLocal = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
    const todayStr = todayLocal.toISOString().slice(0, 10);

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
        days.push(local.toISOString().slice(0, 10));
    }

    const dayData = days.map(dateStr => {
        let income = 0;
        let expense = 0;
        transactions.forEach(t => {
            if (t.date !== dateStr) return;
            const amt = Number(t.amount) || 0;
            if (t.type === 'income') income += amt;
            else expense += amt;
        });
        return { dateStr, income, expense };
    });

    const hasData = dayData.some(d => d.income > 0 || d.expense > 0);
    if (!hasData) {
        barEmptyEl.style.display = 'block';
        return;
    }

    barEmptyEl.style.display = 'none';

    const maxVal = Math.max(1, ...dayData.map(d => Math.max(d.income, d.expense)));

    dayData.forEach(d => {
        const col = document.createElement('div');
        col.className = 'bar-col';

        const pair = document.createElement('div');
        pair.className = 'bar-pair';

        const incomeH = Math.max(2, (d.income / maxVal) * 120);
        const expenseH = Math.max(2, (d.expense / maxVal) * 120);

        if (d.income > 0) {
            const bar = document.createElement('div');
            bar.className = 'bar-fill bar-income';
            bar.style.height = incomeH + 'px';
            bar.title = `Income: ${formatMoney(d.income)}`;
            pair.appendChild(bar);
        }

        if (d.expense > 0) {
            const bar = document.createElement('div');
            bar.className = 'bar-fill bar-expense';
            bar.style.height = expenseH + 'px';
            bar.title = `Expense: ${formatMoney(d.expense)}`;
            pair.appendChild(bar);
        }

        col.appendChild(pair);

        const valueEl = document.createElement('span');
        valueEl.className = 'bar-value';
        valueEl.textContent = d.dateStr === todayStr ? 'Today' : formatShortDate(d.dateStr);
        col.appendChild(valueEl);

        barChartEl.appendChild(col);
    });

    // Legend
    const legend = document.createElement('div');
    legend.className = 'bar-legend';

    const inc = document.createElement('span');
    inc.className = 'bar-legend-item';
    const incDot = document.createElement('span');
    incDot.className = 'bar-legend-dot';
    incDot.style.background = 'var(--income)';
    inc.appendChild(incDot);
    inc.appendChild(document.createTextNode(' Income'));

    const exp = document.createElement('span');
    exp.className = 'bar-legend-item';
    const expDot = document.createElement('span');
    expDot.className = 'bar-legend-dot';
    expDot.style.background = 'var(--expense)';
    exp.appendChild(expDot);
    exp.appendChild(document.createTextNode(' Expense'));

    legend.appendChild(inc);
    legend.appendChild(exp);
    barChartEl.appendChild(legend);
}

/* ============================================================
   RENDER DASHBOARD
   ============================================================ */
function renderDashboard() {
    const allTotals = getTotals(transactions);
    balanceValue.textContent = formatMoney(allTotals.balance);
    incomeTotalEl.textContent = formatMoney(allTotals.income);
    expenseTotalEl.textContent = formatMoney(allTotals.expense);
    balanceValue.style.color = allTotals.balance < 0 ? '#fecaca' : '';

    // Month-scoped totals
    const monthTxns = transactions.filter(t => {
        const [y, m] = t.date.split('-').map(Number);
        return y === currentYear && m === currentMonth + 1;
    });
    const monthTotals = getTotals(monthTxns);
    monthIncomeEl.textContent = formatMoney(monthTotals.income);
    monthExpenseEl.textContent = formatMoney(monthTotals.expense);
    monthSavingsEl.textContent = formatMoney(monthTotals.balance);
    monthSavingsEl.style.color = monthTotals.balance < 0 ? 'var(--expense)' : 'var(--income)';

    // Today's spending
    const tk = todayKey();
    const todayExpense = transactions
        .filter(t => t.type === 'expense' && t.date === tk)
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    todaySpendingEl.textContent = formatMoney(todayExpense);

    // Charts
    if (chartMonthEl) chartMonthEl.textContent = `${MONTH_NAMES[currentMonth].slice(0, 3)} ${currentYear}`;
    renderDoughnut();
    renderBarChart();

    renderHistory();
}

/* ============================================================
   RENDER HISTORY (grouped + filtered)
   ============================================================ */
function renderHistory() {
    const filters = getFilters();
    const filtered = transactions
        .filter(t => matchesFilters(t, filters))
        .sort((a, b) => b.date.localeCompare(a.date));

    txnListEl.innerHTML = '';

    // Results count badge
    if (resultsCountEl) {
        resultsCountEl.textContent = filtered.length + (filtered.length === 1 ? ' transaction' : ' transactions');
        resultsCountEl.style.display = filtered.length === 0 && !filtersActive() ? 'none' : 'inline-block';
    }

    if (filtered.length === 0) {
        emptyStateEl.style.display = 'block';
        const emptyTitle = emptyStateEl.querySelector('.empty-title');
        const emptyText = emptyStateEl.querySelector('.empty-text');
        const clearBtn = document.getElementById('clearFiltersBtn');
        if (filtersActive()) {
            if (emptyTitle) emptyTitle.textContent = 'No matching transactions';
            if (emptyText) emptyText.textContent = 'Try changing your search or filters.';
            if (clearBtn) clearBtn.style.display = 'inline-flex';
        } else {
            if (emptyTitle) emptyTitle.textContent = 'No transactions yet';
            if (emptyText) emptyText.textContent = 'Tap the ＋ button below to add your first income or expense!';
            if (clearBtn) clearBtn.style.display = 'none';
        }
        return;
    }

    emptyStateEl.style.display = 'none';

    // Group by date
    const groups = new Map();
    filtered.forEach(t => {
        if (!groups.has(t.date)) groups.set(t.date, []);
        groups.get(t.date).push(t);
    });

    groups.forEach((items, date) => {
        const label = document.createElement('li');
        label.className = 'date-group-label';
        label.textContent = formatDateLabel(date);
        txnListEl.appendChild(label);

        items.forEach(t => {
            const cat = CATEGORIES[t.category] || CATEGORIES.other;
            const isIncome = t.type === 'income';

            const li = document.createElement('li');
            li.className = 'txn-item' + (isIncome ? ' txn-income' : '');

            // Icon
            const icon = document.createElement('span');
            icon.className = 'txn-icon';
            icon.textContent = cat.icon;
            icon.style.background = isIncome ? 'var(--income-soft)' : (cat.color + '22');

            // Info block
            const info = document.createElement('div');
            info.className = 'txn-info';

            const top = document.createElement('div');
            top.className = 'txn-top';

            const note = document.createElement('p');
            note.className = 'txn-note';
            note.textContent = t.note || cat.name;

            const typePill = document.createElement('span');
            typePill.className = 'txn-type-pill ' + (isIncome ? 'pill-income' : 'pill-expense');
            typePill.textContent = isIncome ? 'INCOME' : 'EXPENSE';

            top.appendChild(note);
            top.appendChild(typePill);

            const meta = document.createElement('div');
            meta.className = 'txn-meta';

            const catLine = document.createElement('span');
            catLine.className = 'txn-category';
            catLine.textContent = cat.name;

            const dot = document.createElement('span');
            dot.className = 'txn-dot';
            dot.textContent = '·';

            const dateLine = document.createElement('span');
            dateLine.className = 'txn-date';
            dateLine.textContent = formatShortDate(t.date);

            meta.appendChild(catLine);
            meta.appendChild(dot);
            meta.appendChild(dateLine);

            info.appendChild(top);
            info.appendChild(meta);

            // Amount
            const amount = document.createElement('span');
            amount.className = 'txn-amount ' + (isIncome ? 'amount-income' : 'amount-expense');
            amount.textContent = (isIncome ? '+' : '−') + formatMoney(t.amount);

            // Edit
            const editBtn = document.createElement('button');
            editBtn.className = 'txn-edit';
            editBtn.setAttribute('aria-label', `Edit ${t.note || cat.name}`);
            editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
            editBtn.addEventListener('click', () => editTransaction(t.id));

            // Delete
            const delBtn = document.createElement('button');
            delBtn.className = 'txn-delete';
            delBtn.setAttribute('aria-label', `Delete ${t.note || cat.name}`);
            delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
            delBtn.addEventListener('click', () => deleteTransaction(t.id));

            li.appendChild(icon);
            li.appendChild(info);
            li.appendChild(amount);
            li.appendChild(editBtn);
            li.appendChild(delBtn);

            txnListEl.appendChild(li);
        });
    });
}

function formatDateLabel(dateStr) {
    const today = todayKey();
    if (dateStr === today) return 'Today';
    const yest = new Date(Date.now() - 86400000);
    const yestLocal = new Date(yest.getTime() - yest.getTimezoneOffset() * 60000);
    if (dateStr === yestLocal.toISOString().slice(0, 10)) return 'Yesterday';

    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatShortDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/* ============================================================
   ADD / DELETE TRANSACTIONS
   ============================================================ */
function editTransaction(id) {
    const txn = transactions.find(t => t.id === id);
    if (!txn) return;

    selectedType = txn.type || 'expense';

    document.querySelectorAll('.type-btn').forEach(btn => {
        const active = btn.dataset.type === selectedType;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });

    populateCategorySelect();

    amountInput.value = txn.amount;
    categorySelect.value = txn.category;
    noteInput.value = txn.note || '';
    dateInput.value = txn.date;

    txnForm.dataset.editingId = id;
    saveBtn.textContent = 'Update Transaction';

    modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';

    setTimeout(() => amountInput.focus(), 120);
}

function deleteTransaction(id) {
    const txn = transactions.find(t => t.id === id);
    if (!txn) return;
    const label = txn.note || CATEGORIES[txn.category]?.name || 'this transaction';
    if (!confirm(`Delete "${label}"?`)) return;

    transactions = transactions.filter(t => t.id !== id);
    saveData();
    renderDashboard();

    authFetch(`${API_BASE}/transactions/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    }).catch(err => console.error('Failed to delete transaction from API:', err));
}

/* ============================================================
   FORM VALIDATION + SUBMIT
   ============================================================ */
const txnForm = document.getElementById('txnForm');
const amountInput = document.getElementById('amountInput');
const categorySelect = document.getElementById('categorySelect');
const noteInput = document.getElementById('noteInput');
const formErrorEl = document.getElementById('formError');

document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.type-btn').forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        selectedType = btn.dataset.type;
        populateCategorySelect();
    });
});

function validateForm() {
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
        formErrorEl.textContent = 'Please enter a valid amount greater than 0.';
        return null;
    }
    if (!categorySelect.value) {
        formErrorEl.textContent = 'Please select a category.';
        return null;
    }
    if (!dateInput.value) {
        formErrorEl.textContent = 'Please select a date.';
        return null;
    }
    formErrorEl.textContent = '';
    return amount;
}

let isSaving = false;

txnForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) {
        closeModal();
        openAuthModal("login");
        return;
    }
    if (isSaving) return;

    const amount = validateForm();
    if (amount === null) return;

    isSaving = true;

    const editingId = txnForm.dataset.editingId;

    const txn = {
        id: editingId || ('txn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
        type: selectedType,
        amount: Math.round(amount * 100) / 100,
        category: categorySelect.value,
        note: noteInput.value.trim(),
        date: dateInput.value
    };

    try {
        if (editingId) {
            transactions = transactions.map(t => t.id === editingId ? txn : t);
            saveData();

            const response = await authFetch(`${API_BASE}/transactions/${encodeURIComponent(editingId)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(txn)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `API error: ${response.status}`);
            }

            console.log('Transaction updated in Worker API.');
        } else {
            transactions.push(txn);
            saveData();

            const response = await authFetch(`${API_BASE}/transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(txn)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `API error: ${response.status}`);
            }

            console.log('Transaction saved to Worker API.');
        }

        delete txnForm.dataset.editingId;
        saveBtn.textContent = 'Save Transaction';

        closeModal();
        txnForm.reset();
        renderDashboard();
    } catch (err) {
        console.error('Failed to save transaction to API:', err);
        formErrorEl.textContent = 'Could not sync with server. Please try again.';
    } finally {
        isSaving = false;
    }
});

/* ============================================================
   SEARCH / FILTER EVENTS
   ============================================================ */
function refreshViews() {
    renderDoughnut();
    renderBarChart();
    renderHistory();
}

searchInput.addEventListener('input', refreshViews);
typeFilter.addEventListener('change', refreshViews);
categoryFilter.addEventListener('change', refreshViews);

const clearFiltersBtn = document.getElementById('clearFiltersBtn');
if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', () => {
    clearFilters();
    refreshViews();
});

/* ============================================================
   MONTH NAVIGATION
   ============================================================ */
document.getElementById('prevMonth').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    updateMonthLabel();
    renderDashboard();
});

document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    updateMonthLabel();
    renderDashboard();
});

/* ============================================================
   DATA & BACKUP (Export / Import)
   ============================================================ */
function buildBackup() {
    return JSON.stringify({
        app: 'expense-tracker',
        version: 1,
        exportedAt: new Date().toISOString(),
        transactions: transactions
    }, null, 2);
}

function parseBackup(rawText) {
    let data;
    try {
        data = JSON.parse(rawText);
    } catch (e) {
        return { ok: false, error: 'Not valid JSON.' };
    }

    const list = Array.isArray(data) ? data : (data && Array.isArray(data.transactions) ? data.transactions : null);
    if (!list) return { ok: false, error: 'No transactions found in this backup file.' };

    const clean = list
        .filter(t => t && typeof t === 'object'
            && typeof t.amount !== 'undefined' && !isNaN(Number(t.amount))
            && (t.type === 'income' || t.type === 'expense')
            && typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date))
        .map(t => ({
            id: (typeof t.id === 'string' && t.id) ? t.id : ('txn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
            type: t.type,
            amount: Math.round(Number(t.amount) * 100) / 100,
            category: (typeof t.category === 'string' && CATEGORIES[t.category]) ? t.category : 'other',
            note: (typeof t.note === 'string' ? t.note : ''),
            date: t.date
        }));

    if (clean.length === 0) return { ok: false, error: 'Backup contains no valid transactions.' };
    return { ok: true, list: clean };
}

const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFileInput = document.getElementById('importFileInput');

exportBtn.addEventListener('click', async () => {
    if (!currentUser) {
        alert('Please login first.');
        openAuthModal('login');
        return;
    }

    try {
        const response = await authFetch(`${API_BASE}/export`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || `Export failed (${response.status})`);
        }

        if (!Array.isArray(data.transactions) || data.transactions.length === 0) {
            alert('Nothing to export yet — add a transaction first.');
            return;
        }

        const backup = JSON.stringify({
            app: 'expense-tracker',
            version: 1,
            exportedAt: new Date().toISOString(),
            transactions: data.transactions
        }, null, 2);

        const blob = new Blob([backup], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'expense-tracker-backup-' + todayKey() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Export error:', err);
        alert(err.message || 'Export failed.');
    }
});

importBtn.addEventListener('click', () => {
    if (!currentUser) {
        alert('Please login first.');
        openAuthModal('login');
        return;
    }
    importFileInput.click();
});

importFileInput.addEventListener('change', () => {
    const file = importFileInput.files && importFileInput.files[0];
    importFileInput.value = '';
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {
        const result = parseBackup(String(reader.result));

        if (!result.ok) {
            alert(result.error);
            return;
        }

        if (!confirm('Import ' + result.list.length + ' transaction(s)? This will replace your current '
            + transactions.length + ' transaction(s).')) return;

        try {
            const response = await authFetch(`${API_BASE}/transactions/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactions: result.list })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || `Import failed (${response.status})`);
            }

            await loadTransactionsFromAPI();
            alert('Imported ' + result.list.length + ' transaction(s).');
        } catch (err) {
            console.error('Import error:', err);
            alert(err.message || 'Import failed.');
        }
    };

    reader.onerror = () => alert('Could not read the file.');
    reader.readAsText(file);
});

/* ============================================================
   AUTHENTICATION
   ============================================================ */
const authArea = document.getElementById('authArea');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const authModalOverlay = document.getElementById('authModalOverlay');
const authModalClose = document.getElementById('authModalClose');
const authModalTitle = document.getElementById('authModalTitle');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authError = document.getElementById('authError');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authSwitchBtn = document.getElementById('authSwitchBtn');

let authMode = 'login';
let currentUser = null;

function setAuthError(message) {
    authError.textContent = message || '';
}

function openAuthModal(mode = 'login') {
    authMode = mode;
    authModalTitle.textContent = mode === 'login' ? 'Login' : 'Sign Up';
    authSubmitBtn.textContent = mode === 'login' ? 'Login' : 'Create Account';
    authSwitchBtn.textContent = mode === 'login'
        ? "Don't have an account? Sign Up"
        : 'Already have an account? Login';
    authPassword.setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
    setAuthError('');
    authModalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => authEmail.focus(), 120);
}

function closeAuthModal() {
    authModalOverlay.hidden = true;
    document.body.style.overflow = '';
    authForm.reset();
    setAuthError('');
}

function renderAuthUI() {
    if (currentUser) {
        authArea.innerHTML = `
            <span class="auth-user" title="${currentUser.email}">${currentUser.email}</span>
            <button class="btn btn-ghost-main auth-btn" id="logoutBtn">Logout</button>
        `;
        document.getElementById('logoutBtn').addEventListener('click', logout);
    } else {
        authArea.innerHTML = `
            <button class="btn btn-primary auth-btn" id="loginBtn">Login</button>
            <button class="btn btn-ghost-main auth-btn" id="signupBtn">Sign Up</button>
        `;
        document.getElementById('loginBtn').addEventListener('click', () => openAuthModal('login'));
        document.getElementById('signupBtn').addEventListener('click', () => openAuthModal('signup'));
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError('');

    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (!email || !password) {
        setAuthError('Please enter your email and password.');
        return;
    }

    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = authMode === 'login' ? 'Logging in...' : 'Creating account...';

    try {
        const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || `Authentication failed (${response.status})`);
        }

        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        currentUser = data.user;
        renderAuthUI();
        closeAuthModal();

        transactions = [];
        saveData();
        renderDashboard();
        await loadTransactionsFromAPI();
    } catch (err) {
        console.error('Authentication error:', err);
        setAuthError(err.message || 'Authentication failed.');
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = authMode === 'login' ? 'Login' : 'Create Account';
    }
}

async function logout() {
    try {
        if (getAuthToken()) {
            await authFetch(`${API_BASE}/auth/logout`, { method: 'POST' });
        }
    } catch (err) {
        console.error('Logout request failed:', err);
    }

    localStorage.removeItem(AUTH_TOKEN_KEY);
    currentUser = null;
    transactions = [];
    saveData();
    renderDashboard();
    renderAuthUI();
}

async function restoreAuthSession() {
    const token = getAuthToken();

    if (!token) {
        currentUser = null;
        renderAuthUI();
        transactions = [];
        renderDashboard();
        return false;
    }

    try {
        const response = await authFetch(`${API_BASE}/auth/me`);

        if (!response.ok) {
            localStorage.removeItem(AUTH_TOKEN_KEY);
            currentUser = null;
            renderAuthUI();
            transactions = [];
            renderDashboard();
            return false;
        }

        const data = await response.json();
        currentUser = data.user;
        renderAuthUI();
        return true;
    } catch (err) {
        console.error('Could not restore authentication:', err);
        currentUser = null;
        transactions = [];
        renderDashboard();
        renderAuthUI();
        return false;
    }
}

loginBtn.addEventListener('click', () => openAuthModal('login'));
signupBtn.addEventListener('click', () => openAuthModal('signup'));
authModalClose.addEventListener('click', closeAuthModal);

authSwitchBtn.addEventListener('click', () => {
    openAuthModal(authMode === 'login' ? 'signup' : 'login');
});

authModalOverlay.addEventListener('click', (e) => {
    if (e.target === authModalOverlay) closeAuthModal();
});

authForm.addEventListener('submit', handleAuthSubmit);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !authModalOverlay.hidden) closeAuthModal();
});

/* ============================================================
   INIT
   ============================================================ */
async function init() {
    populateCategorySelect();
    populateCategoryFilter();
    updateMonthLabel();
    renderDashboard();

    const authenticated = await restoreAuthSession();

    if (authenticated) {
        await loadTransactionsFromAPI();
    }
}

init();
// SpendWise profile dropdown
const profileToggle = document.getElementById("profileToggle");
const profileMenu = document.getElementById("profileMenu");
if (profileToggle && profileMenu) {
  profileToggle.addEventListener("click", () => profileMenu.classList.toggle("show"));
  document.addEventListener("click", (e) => {
    if (!profileToggle.contains(e.target) && !profileMenu.contains(e.target)) profileMenu.classList.remove("show");
  });
}

// SpendWise mobile menu
const spendwiseMenu = document.getElementById("spendwiseMenu");
const spendwiseLinks = document.querySelector(".spendwise-links");
if (spendwiseMenu && spendwiseLinks) {
  spendwiseMenu.addEventListener("click", () => spendwiseLinks.classList.toggle("mobile-open"));
}
