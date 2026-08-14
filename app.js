const STORAGE_KEY = "monea-transactions-php-v3";
const LEGACY_STORAGE_KEYS = ["monea-transactions-php-v2"];

const formatCurrency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

const shortCurrency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const today = new Date();
const pad = (value) => String(value).padStart(2, "0");
const localDateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const monthKeyFromDate = (date) => localDateString(date).slice(0, 7);
const currentMonth = monthKeyFromDate(today);
const todayKey = localDateString(today);

function monthDate(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1, 12);
}

function offsetMonth(monthKey, amount) {
  const date = monthDate(monthKey);
  date.setMonth(date.getMonth() + amount);
  return monthKeyFromDate(date);
}

function daysInMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function dateInMonth(monthKey, day) {
  return `${monthKey}-${pad(Math.max(1, Math.min(day, daysInMonth(monthKey))))}`;
}

function monthLabel(monthKey) {
  return monthFormatter.format(monthDate(monthKey));
}

const currentDay = today.getDate();
const previousMonth = offsetMonth(currentMonth, -1);

const currentMonthSeed = [
  { id: "t1", name: "Salary", note: "Monthly income", category: "Income", type: "income", amount: 82000, date: dateInMonth(currentMonth, currentDay - 1) },
  { id: "t2", name: "Monthly savings", note: "Savings allocation", category: "Savings", type: "savings", amount: 30000, date: dateInMonth(currentMonth, currentDay - 1) },
  { id: "t3", name: "Bhouse + Bills", note: "Housing and household bills", category: "Housing & Bills", type: "expense", amount: 10000, date: dateInMonth(currentMonth, currentDay - 2) },
  { id: "t4", name: "Tablet", note: "Device payment", category: "Shopping", type: "expense", amount: 1754, date: dateInMonth(currentMonth, currentDay - 3) },
  { id: "t5", name: "Pat", note: "Debt repayment", category: "Debt Repayment", type: "expense", amount: 10000, date: dateInMonth(currentMonth, currentDay - 4) },
  { id: "t6", name: "Netflix", note: "Monthly subscription", category: "Entertainment", type: "expense", amount: 449, date: dateInMonth(currentMonth, currentDay - 5) },
  { id: "t7", name: "Wifi nina papa", note: "Internet bill", category: "Utilities", type: "expense", amount: 790, date: dateInMonth(currentMonth, currentDay - 6) },
  { id: "t8", name: "Kevin Utang Monthly", note: "Monthly debt repayment", category: "Debt Repayment", type: "expense", amount: 7000, date: dateInMonth(currentMonth, currentDay - 7) },
  { id: "t9", name: "iPhone", note: "Phone payment", category: "Shopping", type: "expense", amount: 5000, date: dateInMonth(currentMonth, currentDay - 8) },
  { id: "t10", name: "Anna", note: "Debt repayment", category: "Debt Repayment", type: "expense", amount: 1500, date: dateInMonth(currentMonth, currentDay - 9) },
];

const previousMonthSeed = [
  { id: "p1", name: "Salary", note: "Monthly income", category: "Income", type: "income", amount: 78000, date: dateInMonth(previousMonth, 24) },
  { id: "p2", name: "Monthly savings", note: "Savings allocation", category: "Savings", type: "savings", amount: 25000, date: dateInMonth(previousMonth, 24) },
  { id: "p3", name: "Bhouse + Bills", note: "Housing and household bills", category: "Housing & Bills", type: "expense", amount: 11000, date: dateInMonth(previousMonth, 3) },
  { id: "p4", name: "Tablet", note: "Device payment", category: "Shopping", type: "expense", amount: 2200, date: dateInMonth(previousMonth, 7) },
  { id: "p5", name: "Pat", note: "Debt repayment", category: "Debt Repayment", type: "expense", amount: 12000, date: dateInMonth(previousMonth, 9) },
  { id: "p6", name: "Netflix", note: "Monthly subscription", category: "Entertainment", type: "expense", amount: 449, date: dateInMonth(previousMonth, 11) },
  { id: "p7", name: "Wifi nina papa", note: "Internet bill", category: "Utilities", type: "expense", amount: 790, date: dateInMonth(previousMonth, 14) },
  { id: "p8", name: "Kevin Utang Monthly", note: "Monthly debt repayment", category: "Debt Repayment", type: "expense", amount: 7500, date: dateInMonth(previousMonth, 17) },
  { id: "p9", name: "iPhone", note: "Phone payment", category: "Shopping", type: "expense", amount: 3600, date: dateInMonth(previousMonth, 20) },
  { id: "p10", name: "Anna", note: "Debt repayment", category: "Debt Repayment", type: "expense", amount: 1500, date: dateInMonth(previousMonth, 22) },
];

const budgetDefinitions = [
  { category: "Housing & Bills", categories: ["Housing & Bills"], limit: 15000, color: "#1c5c45" },
  { category: "Debt Repayments", categories: ["Debt Repayment"], limit: 22000, color: "#e2ad57" },
  { category: "Subscriptions & Tech", categories: ["Shopping", "Entertainment", "Utilities"], limit: 12000, color: "#8878b7" },
];

const categoryThemes = {
  "Housing & Bills": { className: "housing", color: "#53715f", bg: "#e9f0eb", icon: '<path d="m3 11 9-8 9 8M5 9v11h14V9M9 20v-6h6v6" />' },
  Shopping: { className: "shopping", color: "#947026", bg: "#f7f0dc", icon: '<path d="M6 8h12l1 13H5L6 8Zm3 0V6a3 3 0 0 1 6 0v2" />' },
  "Debt Repayment": { className: "debt", color: "#b15f49", bg: "#f9e9e4", icon: '<path d="M5 7h14v12H5zM8 7V5h8v2M8 12h8m-8 3h5" />' },
  Utilities: { className: "utilities", color: "#426d9d", bg: "#e7eff8", icon: '<path d="M8 15a6 6 0 0 1 8 0m-11-3a10 10 0 0 1 14 0m-8 6h2" />' },
  Entertainment: { className: "entertainment", color: "#705f9d", bg: "#efebf7", icon: '<path d="M4 7h16v12H4zM8 4l2 3m6-3-2 3m-6 5h.01M12 15h4" />' },
  Health: { className: "health", color: "#b45766", bg: "#f8e7ea", icon: '<path d="M12 21S4 16.5 4 9.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5c0 7-8 11.5-8 11.5Z" />' },
  Income: { className: "income", color: "#287655", bg: "#e5f3eb", icon: '<path d="M12 19V5m0 0L7 10m5-5 5 5M5 21h14" />' },
  Savings: { className: "savings", color: "#426d9d", bg: "#e7eff8", icon: '<path d="M5 10h14v10H5zM8 10V8a4 4 0 0 1 8 0v2M9 15h6" />' },
};

function isTransactionList(value) {
  return Array.isArray(value) && value.every((item) => item && typeof item.date === "string");
}

function addMissingHistory(transactions) {
  const hasPreviousMonth = transactions.some((transaction) => transaction.date.startsWith(previousMonth));
  return hasPreviousMonth ? transactions : [...transactions, ...previousMonthSeed];
}

function loadTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isTransactionList(saved)) return saved;

    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = JSON.parse(localStorage.getItem(key));
      if (isTransactionList(legacy)) {
        const migrated = addMissingHistory(legacy);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch {
    // Fall back to the sample data when browser storage is unavailable or malformed.
  }

  const seeded = [...currentMonthSeed, ...previousMonthSeed];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  } catch {
    // The app still works for the current session when storage is blocked.
  }
  return seeded;
}

const state = {
  transactions: loadTransactions(),
  selectedMonth: currentMonth,
  typeFilter: "all",
  categoryFilter: "all",
  search: "",
  visibleLimit: 6,
  balanceVisible: true,
  chartPeriod: "month",
};

const elements = {
  list: document.querySelector("#transaction-list"),
  empty: document.querySelector("#empty-state"),
  emptyMessage: document.querySelector("#empty-message"),
  tableSummary: document.querySelector("#table-summary"),
  viewAll: document.querySelector("#view-all"),
  count: document.querySelector("#transaction-count"),
  balance: document.querySelector("#balance-value"),
  balanceTrend: document.querySelector("#balance-trend"),
  income: document.querySelector("#income-total"),
  expenses: document.querySelector("#expense-total"),
  savings: document.querySelector("#savings-total"),
  formula: document.querySelector("#balance-formula"),
  chart: document.querySelector("#spending-chart"),
  chartYAxis: document.querySelector("#chart-y-axis"),
  chartTotal: document.querySelector("#chart-total"),
  spendingComparison: document.querySelector("#spending-comparison"),
  dialog: document.querySelector("#transaction-dialog"),
  form: document.querySelector("#transaction-form"),
  toast: document.querySelector("#toast"),
  search: document.querySelector("#transaction-search"),
  category: document.querySelector("#category-filter"),
  date: document.querySelector("#transaction-date"),
  periodToolbar: document.querySelector(".period-toolbar"),
  periodTitle: document.querySelector("#period-title"),
  periodMeta: document.querySelector("#period-meta"),
  monthPicker: document.querySelector("#month-picker"),
  previousMonth: document.querySelector("#previous-month"),
  nextMonth: document.querySelector("#next-month"),
  transactionsTitle: document.querySelector("#transactions-title"),
};

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
  } catch {
    showToast("Storage unavailable", "Changes will last only until this tab is closed.");
  }
}

function sanitize(value) {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}

function transactionsForMonth(monthKey = state.selectedMonth) {
  return state.transactions.filter((transaction) => transaction.date.startsWith(monthKey));
}

function getTotals(transactions = transactionsForMonth()) {
  return transactions.reduce(
    (totals, transaction) => {
      if (Object.hasOwn(totals, transaction.type)) totals[transaction.type] += Number(transaction.amount) || 0;
      return totals;
    },
    { income: 0, expense: 0, savings: 0 },
  );
}

function balanceFromTotals(totals) {
  return totals.income - totals.savings - totals.expense;
}

function percentChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function renderPeriod() {
  const monthlyTransactions = transactionsForMonth();
  const isCurrent = state.selectedMonth === currentMonth;
  elements.periodTitle.textContent = monthLabel(state.selectedMonth);
  elements.periodMeta.textContent = isCurrent
    ? `${monthlyTransactions.length} transactions • Saved automatically as you make changes`
    : `Archived month • ${monthlyTransactions.length} transactions preserved`;
  elements.monthPicker.value = state.selectedMonth;
  elements.monthPicker.max = currentMonth;
  elements.nextMonth.disabled = state.selectedMonth >= currentMonth;
  elements.periodToolbar.classList.toggle("is-current", isCurrent);
  elements.transactionsTitle.textContent = `${monthLabel(state.selectedMonth)} transactions`;
}

function renderSummary() {
  const totals = getTotals();
  const previousTotals = getTotals(transactionsForMonth(offsetMonth(state.selectedMonth, -1)));
  const availableIncome = totals.income - totals.savings;
  const balance = balanceFromTotals(totals);
  const previousBalance = balanceFromTotals(previousTotals);
  const change = percentChange(balance, previousBalance);
  const hidden = "••••••";

  elements.balance.textContent = state.balanceVisible ? formatCurrency.format(balance) : hidden;
  elements.income.textContent = state.balanceVisible ? formatCurrency.format(availableIncome) : hidden;
  elements.expenses.textContent = state.balanceVisible ? formatCurrency.format(totals.expense) : hidden;
  elements.savings.textContent = state.balanceVisible ? formatCurrency.format(totals.savings) : hidden;
  elements.formula.textContent = state.balanceVisible
    ? `${formatCurrency.format(totals.income)} income − ${formatCurrency.format(totals.savings)} savings`
    : "Income minus savings and expenses";
  elements.count.textContent = transactionsForMonth().length;

  elements.balanceTrend.classList.remove("negative", "neutral");
  if (change === null) {
    elements.balanceTrend.classList.add("neutral");
    elements.balanceTrend.lastChild.textContent = " New month";
  } else {
    elements.balanceTrend.classList.toggle("negative", change < 0);
    elements.balanceTrend.classList.toggle("neutral", change === 0);
    elements.balanceTrend.lastChild.textContent = ` ${Math.abs(change).toFixed(1)}%`;
  }
  elements.balanceTrend.title = `Balance compared with ${monthLabel(offsetMonth(state.selectedMonth, -1))}`;
}

function filteredTransactions() {
  return transactionsForMonth()
    .filter((transaction) => state.typeFilter === "all" || transaction.type === state.typeFilter)
    .filter((transaction) => state.categoryFilter === "all" || transaction.category === state.categoryFilter)
    .filter((transaction) => {
      const haystack = `${transaction.name} ${transaction.note || ""} ${transaction.category}`.toLowerCase();
      return haystack.includes(state.search.toLowerCase());
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function transactionRow(transaction) {
  const theme = categoryThemes[transaction.category] || categoryThemes.Shopping;
  const sign = transaction.type === "income" ? "+" : "−";
  const safeName = sanitize(transaction.name);
  const safeNote = sanitize(transaction.note || "No note");
  const safeCategory = sanitize(transaction.category);
  const date = new Date(`${transaction.date}T12:00:00`);

  return `
    <tr>
      <td>
        <div class="merchant-cell">
          <span class="category-icon ${theme.className}" style="--icon-color:${theme.color};--icon-bg:${theme.bg}">
            <svg aria-hidden="true" viewBox="0 0 24 24">${theme.icon}</svg>
          </span>
          <span class="merchant-copy"><strong>${safeName}</strong><small>${safeNote}</small></span>
        </div>
      </td>
      <td><span class="category-tag">${safeCategory}</span></td>
      <td>${dateFormatter.format(date)}</td>
      <td><span class="amount ${transaction.type}">${sign}${formatCurrency.format(transaction.amount)}</span></td>
      <td>
        <button class="delete-button" type="button" data-delete-id="${transaction.id}" aria-label="Delete ${safeName}">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" /></svg>
        </button>
      </td>
    </tr>`;
}

function renderTransactions() {
  const filtered = filteredTransactions();
  const visible = filtered.slice(0, state.visibleLimit);
  const hasFilters = state.typeFilter !== "all" || state.categoryFilter !== "all" || state.search;
  elements.list.innerHTML = visible.map(transactionRow).join("");
  elements.empty.hidden = filtered.length > 0;
  elements.list.closest("table").hidden = filtered.length === 0;
  elements.emptyMessage.textContent = hasFilters
    ? "Try a different search or filter."
    : `No transactions were recorded in ${monthLabel(state.selectedMonth)}. Add one to get started.`;
  elements.tableSummary.textContent = filtered.length
    ? `Showing ${visible.length} of ${filtered.length} transactions in ${monthLabel(state.selectedMonth)}`
    : `No matching transactions in ${monthLabel(state.selectedMonth)}`;
  elements.viewAll.hidden = filtered.length <= 6;
  elements.viewAll.textContent = state.visibleLimit >= filtered.length ? "Show fewer" : "View all transactions";
}

function renderBudgets() {
  const expenses = transactionsForMonth().filter((transaction) => transaction.type === "expense");
  const budgets = budgetDefinitions.map((budget) => ({
    ...budget,
    spent: expenses
      .filter((transaction) => budget.categories.includes(transaction.category))
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0),
  }));
  const totalLimit = budgets.reduce((sum, budget) => sum + budget.limit, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const percent = totalLimit ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const remaining = totalLimit - totalSpent;
  const score = document.querySelector(".budget-score");

  score.querySelector("strong").textContent = remaining >= 0 ? "You’re on track" : "Budget needs attention";
  score.querySelector("p").innerHTML = remaining >= 0
    ? `<span id="budget-remaining">${shortCurrency.format(remaining)}</span> left across all budgets.`
    : `<span id="budget-remaining">${shortCurrency.format(Math.abs(remaining))}</span> over your total budget.`;
  document.querySelector(".budget-ring").style.setProperty("--progress", Math.min(percent, 100));
  document.querySelector(".budget-ring span").innerHTML = `${percent}<small>%</small>`;

  document.querySelector("#budget-list").innerHTML = budgets
    .map((budget) => {
      const budgetPercent = budget.limit ? (budget.spent / budget.limit) * 100 : 0;
      const fillColor = budgetPercent > 100 ? "#e47861" : budget.color;
      return `
        <div class="budget-item">
          <div class="budget-item-heading">
            <span class="budget-dot" style="background:${fillColor}"></span>
            <strong>${budget.category}</strong>
            <span><b>${shortCurrency.format(budget.spent)}</b> / ${shortCurrency.format(budget.limit)}</span>
          </div>
          <div class="progress-track" role="progressbar" aria-label="${budget.category} budget used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(budgetPercent)}">
            <div class="progress-fill" style="width:${Math.min(budgetPercent, 100)}%;background:${fillColor}"></div>
          </div>
        </div>`;
    })
    .join("");
}

function expensesOnDate(dateKey) {
  return state.transactions
    .filter((transaction) => transaction.type === "expense" && transaction.date === dateKey)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
}

function chartDataForPeriod(period) {
  if (period === "year") {
    const year = Number(state.selectedMonth.slice(0, 4));
    const labels = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(year, index, 1)));
    const values = labels.map((_, index) => {
      const key = `${year}-${pad(index + 1)}`;
      return getTotals(transactionsForMonth(key)).expense;
    });
    const previousYearTotal = state.transactions
      .filter((transaction) => transaction.type === "expense" && transaction.date.startsWith(String(year - 1)))
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    return { labels, values, comparisonTotal: previousYearTotal, comparisonLabel: String(year - 1) };
  }

  if (period === "week") {
    const selectedDate = state.selectedMonth === currentMonth
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
      : new Date(monthDate(state.selectedMonth).getFullYear(), monthDate(state.selectedMonth).getMonth(), daysInMonth(state.selectedMonth), 12);
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(selectedDate);
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    const previousDates = dates.map((date) => {
      const previous = new Date(date);
      previous.setDate(previous.getDate() - 7);
      return previous;
    });
    const labels = dates.map((date) => new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date));
    const values = dates.map((date) => expensesOnDate(localDateString(date)));
    const comparisonTotal = previousDates.reduce((sum, date) => sum + expensesOnDate(localDateString(date)), 0);
    return { labels, values, comparisonTotal, comparisonLabel: "previous week" };
  }

  const weekCount = Math.ceil(daysInMonth(state.selectedMonth) / 7);
  const labels = Array.from({ length: weekCount }, (_, index) => `W${index + 1}`);
  const values = labels.map((_, weekIndex) => transactionsForMonth()
    .filter((transaction) => transaction.type === "expense" && Math.floor((Number(transaction.date.slice(-2)) - 1) / 7) === weekIndex)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0));
  return {
    labels,
    values,
    comparisonTotal: getTotals(transactionsForMonth(offsetMonth(state.selectedMonth, -1))).expense,
    comparisonLabel: monthLabel(offsetMonth(state.selectedMonth, -1)),
  };
}

function renderChart() {
  const data = chartDataForPeriod(state.chartPeriod);
  const highestValue = Math.max(...data.values, 0);
  const max = highestValue > 0 ? highestValue * 1.08 : 1;
  const axisStep = highestValue > 20000 ? 5000 : highestValue > 5000 ? 2500 : 1000;
  const axisMaximum = highestValue > 0 ? Math.ceil(highestValue / axisStep) * axisStep : axisStep;
  const total = data.values.reduce((sum, value) => sum + value, 0);
  const change = percentChange(total, data.comparisonTotal);

  elements.chartTotal.textContent = shortCurrency.format(total);
  elements.chart.setAttribute("aria-label", `${state.chartPeriod} spending totaling ${shortCurrency.format(total)}`);
  elements.chartYAxis.innerHTML = [1, 0.75, 0.5, 0.25, 0]
    .map((ratio) => `<span>${shortCurrency.format(axisMaximum * ratio)}</span>`)
    .join("");
  elements.chart.innerHTML = data.values
    .map((value, index) => {
      const height = value > 0 ? Math.max((value / max) * 100, 4) : 2;
      const highlight = value > 0 && value === highestValue ? "highlight" : "";
      return `
        <div class="chart-bar-group" style="--height:${height}%">
          <button class="chart-bar ${highlight}" type="button" style="height:${height}%" aria-label="${data.labels[index]}: ${formatCurrency.format(value)}"></button>
          <span class="chart-tooltip">${formatCurrency.format(value)}</span>
          <label>${data.labels[index]}</label>
        </div>`;
    })
    .join("");

  elements.spendingComparison.classList.toggle("warning", change !== null && change > 0);
  if (change === null) elements.spendingComparison.textContent = `No data for ${data.comparisonLabel}`;
  else if (change === 0) elements.spendingComparison.textContent = `Same as ${data.comparisonLabel}`;
  else elements.spendingComparison.textContent = `${Math.abs(change).toFixed(0)}% ${change < 0 ? "less" : "more"} than ${data.comparisonLabel}`;
}

function renderAll() {
  renderPeriod();
  renderSummary();
  renderTransactions();
  renderBudgets();
  renderChart();
}

function defaultDateForSelectedMonth() {
  if (state.selectedMonth === currentMonth) return todayKey;
  return dateInMonth(state.selectedMonth, Math.min(today.getDate(), daysInMonth(state.selectedMonth)));
}

function openDialog() {
  elements.date.max = todayKey;
  elements.date.value = defaultDateForSelectedMonth();
  elements.dialog.showModal();
  window.setTimeout(() => document.querySelector("#amount").focus(), 50);
}

function closeDialog() {
  elements.dialog.close();
  elements.form.reset();
}

let toastTimer;
let toastAction = null;
function showToast(title, message, actionLabel = "", action = null) {
  const actionButton = document.querySelector("#toast-action");
  elements.toast.querySelector("strong").textContent = title;
  elements.toast.querySelector("p").textContent = message;
  actionButton.textContent = actionLabel;
  actionButton.hidden = !actionLabel;
  toastAction = action;
  elements.toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 4200);
}

function addTransaction(form) {
  const data = new FormData(form);
  const transaction = {
    id: `t-${Date.now()}`,
    name: data.get("name").trim(),
    note: data.get("note").trim(),
    category: data.get("category"),
    type: data.get("type"),
    amount: Number(data.get("amount")),
    date: data.get("date"),
  };

  if (!transaction.name || !transaction.date || !transaction.category || transaction.amount <= 0) return;
  if (transaction.type === "income") transaction.category = "Income";
  if (transaction.type === "savings") transaction.category = "Savings";

  state.transactions.push(transaction);
  state.selectedMonth = transaction.date.slice(0, 7);
  state.visibleLimit = 6;
  saveTransactions();
  renderAll();
  closeDialog();
  showToast("Transaction added", `${transaction.name} was saved to ${monthLabel(state.selectedMonth)}.`);
}

function deleteTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;
  state.transactions = state.transactions.filter((item) => item.id !== id);
  saveTransactions();
  renderAll();
  showToast("Transaction removed", `${transaction.name} was removed.`, "Undo", () => {
    state.transactions.push(transaction);
    saveTransactions();
    renderAll();
    showToast("Transaction restored", `${transaction.name} is back in ${monthLabel(transaction.date.slice(0, 7))}.`);
  });
}

function selectMonth(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(monthKey) || monthKey > currentMonth) return;
  state.selectedMonth = monthKey;
  state.visibleLimit = 6;
  renderAll();
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportSelectedMonth() {
  const transactions = transactionsForMonth().sort((a, b) => new Date(a.date) - new Date(b.date));
  const totals = getTotals(transactions);
  const rows = [
    ["Date", "Type", "Name", "Category", "Note", "Amount (PHP)"],
    ...transactions.map((transaction) => [transaction.date, transaction.type, transaction.name, transaction.category, transaction.note || "", transaction.amount]),
    [],
    ["Monthly summary", "Amount (PHP)"],
    ["Gross income", totals.income],
    ["Savings", totals.savings],
    ["Expenses", totals.expense],
    ["Remaining balance", balanceFromTotals(totals)],
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `monea-${state.selectedMonth}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Monthly report exported", `${monthLabel(state.selectedMonth)} was downloaded as a CSV file.`);
}

document.querySelector("#today-label").textContent = fullDateFormatter.format(today);
const currentHour = today.getHours();
const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";
document.querySelector("#greeting").textContent = `${greeting}, Alex.`;

document.querySelectorAll("[data-open-dialog]").forEach((button) => button.addEventListener("click", openDialog));
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", closeDialog));

elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) closeDialog();
});

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  addTransaction(event.currentTarget);
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.typeFilter = button.dataset.filter;
    state.visibleLimit = 6;
    renderTransactions();
  });
});

document.querySelectorAll("[data-period]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-period]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.chartPeriod = button.dataset.period;
    renderChart();
  });
});

elements.search.addEventListener("input", (event) => {
  state.search = event.target.value.trim();
  state.visibleLimit = 6;
  renderTransactions();
});

elements.category.addEventListener("change", (event) => {
  state.categoryFilter = event.target.value;
  state.visibleLimit = 6;
  renderTransactions();
});

elements.list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-id]");
  if (button) deleteTransaction(button.dataset.deleteId);
});

elements.viewAll.addEventListener("click", () => {
  const total = filteredTransactions().length;
  state.visibleLimit = state.visibleLimit >= total ? 6 : total;
  renderTransactions();
});

document.querySelector("#toggle-balance").addEventListener("click", (event) => {
  state.balanceVisible = !state.balanceVisible;
  event.currentTarget.closest(".balance-card").classList.toggle("balance-hidden", !state.balanceVisible);
  event.currentTarget.setAttribute("aria-label", state.balanceVisible ? "Hide balance" : "Show balance");
  renderSummary();
});

document.querySelector("#manage-budgets").addEventListener("click", () => {
  const totalLimit = budgetDefinitions.reduce((sum, budget) => sum + budget.limit, 0);
  const spent = getTotals().expense;
  showToast("Monthly budget status", `${shortCurrency.format(Math.max(totalLimit - spent, 0))} remains in ${monthLabel(state.selectedMonth)}.`);
});

document.querySelectorAll('input[name="type"]').forEach((input) => {
  input.addEventListener("change", (event) => {
    const category = elements.form.elements.category;
    if (event.target.value === "income") category.value = "Income";
    else if (event.target.value === "savings") category.value = "Savings";
    else if (["Income", "Savings"].includes(category.value)) category.value = "";
  });
});

elements.previousMonth.addEventListener("click", () => selectMonth(offsetMonth(state.selectedMonth, -1)));
elements.nextMonth.addEventListener("click", () => selectMonth(offsetMonth(state.selectedMonth, 1)));
elements.monthPicker.addEventListener("change", (event) => selectMonth(event.target.value));
document.querySelector("#this-month").addEventListener("click", () => selectMonth(currentMonth));
document.querySelector("#export-month").addEventListener("click", exportSelectedMonth);
document.querySelector("#toast-action").addEventListener("click", () => {
  if (toastAction) toastAction();
  toastAction = null;
});

renderAll();
