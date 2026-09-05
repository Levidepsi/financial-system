(function (root) {
  const limits = { income: 2, expense: 5 };
  function normalize(type, value) {
    if (!Object.hasOwn(limits, type) || typeof value !== "string") return null;
    const name = value.trim().replace(/\s+/g, " ");
    if (!name || name.length > 40 || /[\u0000-\u001f\u007f]/.test(value)
      || ["all", "__custom__", "savings"].includes(name.toLowerCase())
      || (type === "expense" && name.toLowerCase() === "income")) return null;
    return { type, name };
  }
  function key(category) { return `${category.type}:${category.name.toLowerCase()}`; }
  function merge(existing, additions) {
    const categories = new Map();
    for (const item of [...existing, ...additions]) {
      const category = normalize(item.type, item.name);
      if (category && !categories.has(key(category))) categories.set(key(category), { ...item, ...category });
    }
    return [...categories.values()];
  }
  function fromTransactions(transactions) {
    return transactions.filter((item) => Object.hasOwn(limits, item.type)).map((item) => ({ type: item.type, name: item.category }));
  }
  function message(type, plan) {
    return `You have reached the ${limits[type]}-${type}-category limit for the ${plan === "normal" ? "Normal" : "Free"} plan.`;
  }
  function check(existing, proposed, plan) {
    if (plan === "premium") return;
    const known = new Set(existing.map(key));
    for (const type of Object.keys(limits)) {
      const all = proposed.filter((item) => item.type === type);
      if (all.length > limits[type] && all.some((item) => !known.has(key(item)))) throw new Error(message(type, plan));
    }
  }
  const policy = { limits, normalize, key, merge, fromTransactions, message, check };
  if (typeof module !== "undefined" && module.exports) module.exports = policy;
  else root.CategoryPolicy = policy;
})(globalThis);
