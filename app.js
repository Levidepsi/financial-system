const STORAGE_KEY = "monea-transactions-php-v3";
const LEGACY_STORAGE_KEYS = ["monea-transactions-php-v2"];
const CUSTOM_CATEGORIES_STORAGE_KEY = "monea-custom-categories-v1";
const CUSTOM_CATEGORY_VALUE = "__custom__";

const defaultExpenseCategories = [
  "Housing & Bills",
  "Shopping",
  "Debt Repayment",
  "Utilities",
  "Entertainment",
  "Health",
];
const builtInCategories = [...defaultExpenseCategories, "Income", "Savings"];

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

function normalizeCategoryName(value) {
  if (typeof value !== "string") return "";
  const category = value.trim().replace(/\s+/g, " ");
  if (!category
    || category.length > 40
    || ["all", CUSTOM_CATEGORY_VALUE].includes(category.toLowerCase())
    || /[\u0000-\u001f\u007f]/.test(category)) return "";
  return builtInCategories.find((name) => name.toLowerCase() === category.toLowerCase()) ?? category;
}

function isCustomExpenseCategory(category) {
  return category
    && !builtInCategories.some((name) => name.toLowerCase() === category.toLowerCase());
}

function normalizeTransaction(item) {
  if (!item || typeof item !== "object") return null;

  const id = typeof item.id === "string" ? item.id.trim() : "";
  const name = typeof item.name === "string" ? item.name.trim() : "";
  const note = typeof item.note === "string" ? item.note.trim() : "";
  const type = typeof item.type === "string" ? item.type : "";
  const category = normalizeCategoryName(item.category);
  const amount = Number(item.amount);
  const date = typeof item.date === "string" ? item.date : "";
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    && localDateString(new Date(`${date}T12:00:00`)) === date
    && date <= todayKey;

  if (!/^[\w-]{1,100}$/.test(id)
    || !name || name.length > 60
    || note.length > 100
    || !["expense", "income", "savings"].includes(type)
    || !category
    || (type !== "savings" && !CategoryPolicy.normalize(type, category))
    || (type === "expense" && ["income", "savings"].includes(category.toLowerCase()))
    || !Number.isFinite(amount) || amount <= 0 || amount > 999999999.99
    || !validDate) return null;

  return {
    id,
    name,
    note,
    type,
    category: type === "savings" ? "Savings" : category,
    amount: Math.round(amount * 100) / 100,
    date,
    paid: type === "expense" && category === "Debt Repayment" && item.paid === true,
  };
}

function normalizeTransactionList(value) {
  if (!Array.isArray(value)) return null;
  const transactions = value.map(normalizeTransaction);
  if (transactions.some((transaction) => !transaction)) return null;
  if (new Set(transactions.map((transaction) => transaction.id)).size !== transactions.length) return null;
  return transactions;
}

function addMissingHistory(transactions) {
  const hasPreviousMonth = transactions.some((transaction) => transaction.date.startsWith(previousMonth));
  return hasPreviousMonth ? transactions : [...transactions, ...previousMonthSeed];
}

function loadTransactions() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const saved = normalizeTransactionList(Array.isArray(stored) ? stored : stored?.transactions);
    if (saved) return saved;

    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = normalizeTransactionList(JSON.parse(localStorage.getItem(key)));
      if (legacy) {
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

function loadCustomCategories(transactions) {
  let savedCategories = [];
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY));
    if (Array.isArray(saved)) savedCategories = saved;
  } catch {
    // Categories used by saved transactions are still recovered below.
  }

  const categories = [
    ...savedCategories,
    ...transactions
      .filter((transaction) => transaction.type === "expense")
      .map((transaction) => transaction.category),
  ]
    .map(normalizeCategoryName)
    .filter(isCustomExpenseCategory);

  return categories.filter((category, index) => (
    categories.findIndex((item) => item.toLowerCase() === category.toLowerCase()) === index
  ));
}

const initialTransactions = loadTransactions();

function loadCategoryRegistry(transactions) {
  let saved = [];
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    saved = Array.isArray(stored?.categories) ? stored.categories
      : loadCustomCategories(transactions).map((name) => ({ type: "expense", name }));
  } catch { /* Recover categories from the ledger below. */ }
  return CategoryPolicy.merge(saved, CategoryPolicy.fromTransactions(transactions));
}

const state = {
  transactions: initialTransactions,
  categories: loadCategoryRegistry(initialTransactions),
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
  importCsv: document.querySelector("#import-csv"),
  importCsvFile: document.querySelector("#import-csv-file"),
  periodToolbar: document.querySelector(".period-toolbar"),
  periodTitle: document.querySelector("#period-title"),
  periodMeta: document.querySelector("#period-meta"),
  monthPicker: document.querySelector("#month-picker"),
  previousMonth: document.querySelector("#previous-month"),
  nextMonth: document.querySelector("#next-month"),
  transactionsTitle: document.querySelector("#transactions-title"),
  formCategory: document.querySelector("#transaction-category"),
  customCategory: document.querySelector("#custom-category"),
  customCategoryField: document.querySelector("#custom-category-field"),
};

let localSnapshot;
try { localSnapshot = localStorage.getItem(STORAGE_KEY); } catch { localSnapshot = null; }

async function saveTransactions(transactions, extraCategories = []) {
  const account = window.MoneaAccount;
  const identity = account?.identity;
  const expectedSnapshot = localSnapshot;
  try {
    if (!account || account.mode === "loading") throw new Error("Wait for account settings to finish loading.");
    const categories = CategoryPolicy.merge(state.categories, [...extraCategories, ...CategoryPolicy.fromTransactions(transactions)]);
    if (account.mode === "account") {
      await account.save(transactions);
      return true;
    }
    const persist = () => {
      if (account.identity !== identity || account.mode !== "guest") throw new Error("Your account changed. Please try again.");
      if (localStorage.getItem(STORAGE_KEY) !== expectedSnapshot) {
        refreshSharedData();
        throw new Error("Another tab changed your data. The latest version has been loaded; try again.");
      }
      const canonicalTransactions = transactions.map((item) => {
        const category = categories.find((candidate) => candidate.type === item.type && candidate.name.toLowerCase() === item.category.toLowerCase());
        return category ? { ...item, category: category.name } : item;
      });
      const serialized = JSON.stringify({ transactions: canonicalTransactions, categories });
      localStorage.setItem(STORAGE_KEY, serialized);
      localSnapshot = serialized;
      state.transactions = canonicalTransactions;
      state.categories = categories;
    };
    if (navigator.locks) await navigator.locks.request("monea-local-transactions", persist);
    else persist();
    return true;
  } catch (error) {
    showToast("Changes not saved", error.message || "Storage is unavailable. Please try again.");
    return false;
  }
}

function canonicalAvailableCategoryName(value) {
  const category = normalizeCategoryName(value);
  return [...builtInCategories, ...state.categories.map((item) => item.name)]
    .find((name) => name.toLowerCase() === category.toLowerCase()) ?? category;
}

function replaceCategoryOptions(select, options, fallbackValue) {
  const currentValue = select.value;
  select.replaceChildren(...options.map(({ label, value }) => new Option(label, value)));
  select.value = options.some((option) => option.value === currentValue) ? currentValue : fallbackValue;
}

function renderCategoryOptions() {
  const type = elements.form.querySelector('input[name="type"]:checked').value;
  const existing = state.categories.filter((item) => item.type === type).map((item) => item.name);
  const suggestions = type === "income" ? ["Income", "Salary", "Freelance"] : defaultExpenseCategories;
  const available = type === "savings" ? ["Savings"]
    : [...new Set([...existing, ...suggestions.filter((name) => !existing.some((item) => item.toLowerCase() === name.toLowerCase()))])];
  replaceCategoryOptions(elements.formCategory, [
    { label: "Select category", value: "" },
    ...available.map((category) => ({ label: category, value: category })),
    ...(type !== "savings" ? [{ label: "+ Add category", value: CUSTOM_CATEGORY_VALUE }] : []),
  ], type === "savings" ? "Savings" : type === "income" ? available[0] || "" : "");
  if (type !== "expense" && !elements.formCategory.value) elements.formCategory.value = available[0] || "";
  replaceCategoryOptions(elements.category, [
    { label: "All categories", value: "all" },
    ...[...new Set(state.categories.map((item) => item.name))].map((name) => ({ label: name, value: name })),
    { label: "Savings", value: "Savings" },
  ], "all");
  updateCustomCategoryField();
}

function updateCustomCategoryField({ focus = false } = {}) {
  const customSelected = elements.formCategory.value === CUSTOM_CATEGORY_VALUE;
  elements.customCategoryField.hidden = !customSelected;
  elements.customCategory.required = customSelected;
  if (customSelected && focus) elements.customCategory.focus();
}

function sanitize(value) {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML.replaceAll('"', "&quot;").replaceAll("'", "&#39;");
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
    .filter((transaction) => {
      if (state.typeFilter === "loans") return transaction.category === "Debt Repayment" && !transaction.paid;
      if (state.typeFilter === "paid-loans") return transaction.category === "Debt Repayment" && transaction.paid;
      return state.typeFilter === "all" || transaction.type === state.typeFilter;
    })
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
        ${transaction.category === "Debt Repayment" ? `<button class="loan-status-button" type="button" data-loan-id="${transaction.id}" aria-pressed="${transaction.paid === true}" aria-label="${transaction.paid ? "Mark unpaid" : "Mark paid"}: ${safeName}">${transaction.paid ? "Paid · Undo" : "Mark paid"}</button>` : ""}
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
  const totals = getTotals();
  const budgets = budgetDefinitions.map((budget) => ({
    ...budget,
    spent: expenses
      .filter((transaction) => budget.categories.includes(transaction.category))
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0),
  }));
  const availableIncome = totals.income - totals.savings;
  const totalSpent = totals.expense;
  const percent = availableIncome > 0 ? Math.round((totalSpent / availableIncome) * 100) : totalSpent > 0 ? 100 : 0;
  const remaining = balanceFromTotals(totals);
  const score = document.querySelector(".budget-score");

  score.querySelector("strong").textContent = remaining >= 0 ? "You’re on track" : "Budget needs attention";
  score.querySelector("p").innerHTML = remaining >= 0
    ? `<span id="budget-remaining">${shortCurrency.format(remaining)}</span> left after savings and expenses.`
    : `<span id="budget-remaining">${shortCurrency.format(Math.abs(remaining))}</span> over your available funds.`;
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
            <span><b>${shortCurrency.format(budget.spent)}</b></span>
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
  renderAccountUsage();
}

function renderAccountUsage() {
  const account = window.MoneaAccount;
  const status = document.querySelector("#account-status");
  const usage = document.querySelector("#account-usage");
  if (!account || account.mode === "loading") {
    status.textContent = "Loading account…";
    usage.textContent = "Please wait before saving changes.";
    return;
  }
  const income = state.categories.filter((item) => item.type === "income").length;
  const expense = state.categories.filter((item) => item.type === "expense").length;
  status.textContent = account.mode === "guest" ? "Free · Saved on this device" : "Free · Synced to your account";
  usage.textContent = `${income} income categories · ${expense} expense categories · Unlimited categories and transactions.${account.mode === "guest" ? " Sign in to sync across devices." : ""}`;
}

function defaultDateForSelectedMonth() {
  if (state.selectedMonth === currentMonth) return todayKey;
  return dateInMonth(state.selectedMonth, Math.min(today.getDate(), daysInMonth(state.selectedMonth)));
}

function openDialog() {
  renderCategoryOptions();
  elements.date.max = todayKey;
  elements.date.value = defaultDateForSelectedMonth();
  elements.dialog.showModal();
  window.setTimeout(() => document.querySelector("#amount").focus(), 50);
}

function closeDialog() {
  elements.dialog.close();
  elements.form.reset();
  renderCategoryOptions();
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

async function addTransaction(form) {
  const data = new FormData(form);
  const type = String(data.get("type") ?? "");
  const selectedCategory = String(data.get("category") ?? "");
  const category = type !== "savings" && selectedCategory === CUSTOM_CATEGORY_VALUE
    ? canonicalAvailableCategoryName(data.get("customCategory"))
    : selectedCategory;
  const transaction = normalizeTransaction({
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(data.get("name") ?? ""),
    note: String(data.get("note") ?? ""),
    category: type === "savings" ? "Savings" : category,
    type,
    amount: Number(data.get("amount")),
    date: String(data.get("date") ?? ""),
  });

  if (!transaction) {
    showToast("Check transaction details", "Enter a valid name, category, date, and positive amount.");
    return;
  }

  if (!await saveTransactions([...state.transactions, transaction])) return;
  state.selectedMonth = transaction.date.slice(0, 7);
  state.visibleLimit = 6;
  renderCategoryOptions();
  renderAll();
  closeDialog();
  showToast("Transaction added", `${transaction.name} was saved to ${monthLabel(state.selectedMonth)}.`);
}

async function deleteTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;
  const identity = window.MoneaAccount?.identity;
  if (!await saveTransactions(state.transactions.filter((item) => item.id !== id))) return;
  renderAll();
  showToast("Transaction removed", `${transaction.name} was removed.`, "Undo", async () => {
    if (window.MoneaAccount?.identity !== identity) return;
    if (!await saveTransactions([...state.transactions, transaction])) return;
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
  let text = String(value ?? "");
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadFile(contents, type, filename) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function backupData() {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: state.transactions,
  };
  downloadFile(JSON.stringify(backup, null, 2), "application/json;charset=utf-8", `monea-backup-${todayKey}.json`);
  showToast("Backup downloaded", `${state.transactions.length} transactions were saved to a JSON file.`);
}

async function restoreData(event) {
  const identity = window.MoneaAccount?.identity;
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;

  try {
    if (file.size > 2_000_000) throw new Error("Backup files must be smaller than 2 MB.");
    const backup = JSON.parse(await file.text());
    const backupTransactions = Array.isArray(backup)
      ? backup
      : backup && typeof backup === "object" ? backup.transactions : null;
    const transactions = normalizeTransactionList(backupTransactions);
    if (!transactions) throw new Error("This file is not a valid Monea backup.");

    const confirmed = window.confirm(`Replace your current ${state.transactions.length} transactions with ${transactions.length} from this backup?`);
    if (!confirmed) return;

    if (window.MoneaAccount?.identity !== identity) throw new Error("Your account changed. Select the file again.");
    if (!await saveTransactions(transactions)) return;
    state.selectedMonth = transactions.length
      ? transactions.map((transaction) => transaction.date.slice(0, 7)).sort().at(-1)
      : currentMonth;
    state.visibleLimit = 6;
    renderAll();
    showToast("Backup restored", `${transactions.length} transactions are now available.`);
  } catch (error) {
    showToast("Restore failed", error instanceof Error ? error.message : "The backup could not be read.");
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field === "") {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (quoted) throw new Error("The CSV contains an unfinished quoted value.");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizeCsvDate(value) {
  const date = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const match = date.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  return match ? `${match[3]}-${pad(match[1])}-${pad(match[2])}` : date;
}

function transactionFingerprint(transaction) {
  return [
    transaction.date,
    transaction.type,
    transaction.name.toLowerCase(),
    transaction.category,
    transaction.note.toLowerCase(),
    transaction.amount.toFixed(2),
  ].join("\u001f");
}

async function importCsv(event) {
  const identity = window.MoneaAccount?.identity;
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;

  try {
    if (file.size > 5_000_000) throw new Error("CSV files must be smaller than 5 MB.");
    const rows = parseCsv(await file.text());
    if (rows.length < 2) throw new Error("The CSV does not contain transaction rows.");

    const headers = rows[0].map((header) => header.trim().toLowerCase().replace(/\s+/g, " "));
    const column = (...names) => headers.findIndex((header) => names.includes(header));
    const columns = {
      date: column("date", "transaction date"),
      type: column("type", "transaction type"),
      name: column("name", "transaction", "description"),
      category: column("category"),
      note: column("note", "notes"),
      amount: column("amount", "amount (php)", "amount php"),
      paid: column("paid", "loan paid"),
    };
    if ([columns.date, columns.type, columns.name, columns.category, columns.amount].includes(-1)) {
      throw new Error("Required columns: Date, Type, Name, Category, and Amount (PHP).");
    }

    const typeAliases = {
      expense: "expense",
      expenses: "expense",
      income: "income",
      incomes: "income",
      saving: "savings",
      savings: "savings",
    };
    const categoryNames = [...builtInCategories, ...state.categories.map((item) => item.name)];
    const existing = new Set(state.transactions.map(transactionFingerprint));
    const imported = [];
    let invalidCount = 0;
    let duplicateCount = 0;

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      if (row.every((value) => !value.trim())) continue;
      if (row[0]?.trim().toLowerCase() === "monthly summary") break;

      const cleanText = (value) => String(value ?? "").trim().replace(/^'(?=[=+\-@\t\r])/, "");
      const type = typeAliases[cleanText(row[columns.type]).toLowerCase()] ?? "";
      const rawCategory = cleanText(row[columns.category]);
      let category = categoryNames.find((name) => name.toLowerCase() === rawCategory.toLowerCase()) ?? rawCategory;
      if (type === "savings") category = "Savings";
      const rawAmount = cleanText(row[columns.amount]).replace(/^PHP\s*/i, "").replace(/[₱,\s]/g, "");
      const transaction = normalizeTransaction({
        id: `t-${Date.now()}-${rowIndex}-${Math.random().toString(36).slice(2, 8)}`,
        name: cleanText(row[columns.name]),
        note: columns.note >= 0 ? cleanText(row[columns.note]) : "",
        category,
        type,
        amount: Number(rawAmount),
        date: normalizeCsvDate(row[columns.date]),
        paid: columns.paid >= 0 && ["true", "yes", "paid"].includes(cleanText(row[columns.paid]).toLowerCase()),
      });

      if (!transaction) {
        invalidCount += 1;
        continue;
      }
      const fingerprint = transactionFingerprint(transaction);
      if (existing.has(fingerprint)) {
        duplicateCount += 1;
        continue;
      }
      existing.add(fingerprint);
      imported.push(transaction);
    }

    if (!imported.length) {
      const reason = duplicateCount
        ? `${duplicateCount} matching transactions already exist.`
        : "No valid transaction rows were found.";
      throw new Error(reason);
    }

    const skipped = invalidCount + duplicateCount;
    const confirmed = window.confirm(`Import ${imported.length} transactions${skipped ? ` and skip ${skipped} invalid or duplicate rows` : ""}?`);
    if (!confirmed) return;

    if (window.MoneaAccount?.identity !== identity) throw new Error("Your account changed. Select the file again.");
    if (!await saveTransactions([...state.transactions, ...imported])) return;
    state.selectedMonth = imported.map((transaction) => transaction.date.slice(0, 7)).sort().at(-1);
    state.visibleLimit = 6;
    renderCategoryOptions();
    renderAll();
    showToast("CSV imported", `${imported.length} transactions added${skipped ? `; ${skipped} rows skipped` : ""}.`);
  } catch (error) {
    showToast("CSV import failed", error instanceof Error ? error.message : "The file could not be read.");
  }
}

function exportSelectedMonth() {
  const transactions = transactionsForMonth().sort((a, b) => new Date(a.date) - new Date(b.date));
  const totals = getTotals(transactions);
  const rows = [
    ["Date", "Type", "Name", "Category", "Note", "Amount (PHP)", "Loan paid"],
    ...transactions.map((transaction) => [transaction.date, transaction.type, transaction.name, transaction.category, transaction.note || "", transaction.amount, transaction.paid === true]),
    [],
    ["Monthly summary", "Amount (PHP)"],
    ["Gross income", totals.income],
    ["Savings", totals.savings],
    ["Expenses", totals.expense],
    ["Remaining balance", balanceFromTotals(totals)],
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  downloadFile(`\uFEFF${csv}`, "text/csv;charset=utf-8", `monea-${state.selectedMonth}.csv`);
  showToast("Monthly report exported", `${monthLabel(state.selectedMonth)} was downloaded as a CSV file.`);
}

document.querySelector("#today-label").textContent = fullDateFormatter.format(today);
const currentHour = today.getHours();
const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";
document.querySelector("#greeting").textContent = `${greeting}, Welcome to Perfi.`;

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
    document.querySelectorAll("[data-filter]").forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-pressed", "false");
    });
    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");
    state.typeFilter = button.dataset.filter;
    state.visibleLimit = 6;
    renderTransactions();
  });
});

document.querySelectorAll("[data-period]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-period]").forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-pressed", "false");
    });
    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");
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

elements.list.addEventListener("click", async (event) => {
  const loanButton = event.target.closest("[data-loan-id]");
  if (loanButton) {
    const transaction = state.transactions.find((item) => item.id === loanButton.dataset.loanId);
    if (!transaction || transaction.category !== "Debt Repayment") return;
    const paid = !transaction.paid;
    if (!await saveTransactions(state.transactions.map((item) => item.id === transaction.id ? { ...item, paid } : item))) return;
    renderAll();
    showToast(paid ? "Loan marked paid" : "Loan marked unpaid", `${transaction.name} is in the ${paid ? "Paid loans" : "Unpaid loans"} tab.`);
    return;
  }
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
  const remaining = balanceFromTotals(getTotals());
  const message = remaining >= 0
    ? `${shortCurrency.format(remaining)} remains in ${monthLabel(state.selectedMonth)}.`
    : `${shortCurrency.format(Math.abs(remaining))} is over your available funds in ${monthLabel(state.selectedMonth)}.`;
  showToast("Monthly budget status", message);
});

document.querySelectorAll('input[name="type"]').forEach((input) => {
  input.addEventListener("change", renderCategoryOptions);
});

elements.formCategory.addEventListener("change", () => updateCustomCategoryField({ focus: true }));

document.querySelector("#export-history").addEventListener("click", async () => {
  const account = window.MoneaAccount;
  if (!account || account.mode === "loading") return;
  try {
    const { transactions } = account.mode === "account" ? await account.historyReport() : { transactions: state.transactions };
    const rows = [["Date", "Type", "Name", "Category", "Note", "Amount (PHP)", "Loan paid"],
      ...transactions.map((item) => [item.date, item.type, item.name, item.category, item.note, item.amount, item.paid])];
    downloadFile(`\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`, "text/csv;charset=utf-8", `perfi-full-history-${todayKey}.csv`);
    showToast("Report exported", "Your full financial history was downloaded.");
  } catch (error) { showToast("Report unavailable", error.message); }
});

elements.previousMonth.addEventListener("click", () => selectMonth(offsetMonth(state.selectedMonth, -1)));
elements.nextMonth.addEventListener("click", () => selectMonth(offsetMonth(state.selectedMonth, 1)));
elements.monthPicker.addEventListener("change", (event) => selectMonth(event.target.value));
document.querySelector("#this-month").addEventListener("click", () => selectMonth(currentMonth));
document.querySelector("#export-month").addEventListener("click", exportSelectedMonth);
// Backup and JSON restore controls are temporarily disabled in index.html.
elements.importCsv.addEventListener("click", () => elements.importCsvFile.click());
elements.importCsvFile.addEventListener("change", importCsv);
document.querySelector("#toast-action").addEventListener("click", () => {
  if (toastAction) toastAction();
  toastAction = null;
});

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // The app remains usable online when service-worker registration is unavailable.
    });
  });
}

function refreshSharedData() {
  if (window.MoneaAccount?.mode === "account") {
    void window.MoneaAccount.refresh().catch(() => {});
    return;
  }
  if (window.MoneaAccount?.mode !== "guest") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = JSON.parse(raw);
    const transactions = raw === null ? [] : normalizeTransactionList(Array.isArray(stored) ? stored : stored?.transactions);
    if (!transactions) {
      showToast("Refresh failed", "Another tab saved invalid data. Your current view has been preserved.");
      return;
    }
    state.transactions = transactions;
    localSnapshot = raw;
    state.categories = loadCategoryRegistry(transactions);
    renderCategoryOptions();
    renderAll();
  } catch {
    showToast("Refresh unavailable", "Browser storage could not be read.");
  }
}

let displayedIdentity = "guest";
document.addEventListener("monea:account", (event) => {
  const { mode, account, user } = event.detail;
  const nextIdentity = user?.id || "guest";
  if (displayedIdentity !== nextIdentity) {
    displayedIdentity = nextIdentity;
    toastAction = null;
    closeDialog();
    state.categoryFilter = "all";
  }
  if (mode === "guest") {
    state.transactions = loadTransactions();
    try { localSnapshot = localStorage.getItem(STORAGE_KEY); } catch { localSnapshot = null; }
    state.categories = loadCategoryRegistry(state.transactions);
  } else {
    state.transactions = account?.transactions || [];
    state.categories = CategoryPolicy.merge(account?.categories || [], CategoryPolicy.fromTransactions(state.transactions));
  }
  renderCategoryOptions();
  state.categoryFilter = elements.category.value;
  renderAll();
});

renderCategoryOptions();
updateCustomCategoryField();
renderAll();

window.addEventListener("storage", (event) => {
  if (event.storageArea === localStorage
    && (event.key === null || [STORAGE_KEY, CUSTOM_CATEGORIES_STORAGE_KEY].includes(event.key))) {
    refreshSharedData();
  }
});

window.addEventListener("focus", refreshSharedData);
