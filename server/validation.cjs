class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function validateTransactions(value) {
  if (!Array.isArray(value)) throw new HttpError(400, "Transactions must be a list.");
  const ids = new Set();
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new HttpError(400, "Invalid transaction.");
    const { id, name, note = "", type, category, amount, date, paid = false } = item;
    const parsedDate = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(`${date}T00:00:00Z`) : new Date(NaN);
    // Allow today's date in all time zones; the browser applies its local-day check.
    const latestDay = new Date(Date.now() + 14 * 3600000).toISOString().slice(0, 10);
    if (typeof id !== "string" || !/^[\w-]{1,100}$/.test(id) || ids.has(id)
      || typeof name !== "string" || !name.trim() || name.length > 60
      || typeof note !== "string" || note.length > 100
      || !["income", "expense", "savings"].includes(type)
      || typeof category !== "string" || !category.trim() || category.length > 40
      || /[\u0000-\u001f\u007f]/.test(category)
      || ["all", "__custom__"].includes(category.toLowerCase())
      || (type === "expense" && ["income", "savings"].includes(category.toLowerCase()))
      || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 999999999.99
      || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date || date > latestDay
      || typeof paid !== "boolean") throw new HttpError(400, "Invalid or duplicate transaction.");
    ids.add(id);
    return { id, name: name.trim(), note: note.trim(), type,
      category: type === "income" ? "Income" : type === "savings" ? "Savings" : category.trim(),
      amount: Math.round(amount * 100) / 100, date,
      paid: type === "expense" && category === "Debt Repayment" && paid };
  });
}

function subscriptionRecord(subscription, prices) {
  const items = subscription.items?.data || [];
  const item = items.length === 1 && items[0];
  const priceId = item && (typeof item.price === "string" ? item.price : item.price.id);
  const plan = priceId === prices.premium ? "premium" : priceId === prices.normal ? "normal" : "none";
  const end = item?.current_period_end ?? subscription.current_period_end;
  return { subscription_id: subscription.id,
    customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    plan, status: subscription.status,
    period_end: Number.isFinite(end) ? new Date(end * 1000).toISOString() : null };
}

module.exports = { HttpError, validateTransactions, subscriptionRecord };
