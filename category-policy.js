(function (root) {
  const types = ["income", "expense"];
  function normalize(type, value) {
    if (!types.includes(type) || typeof value !== "string") return null;
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
    return transactions.filter((item) => types.includes(item.type)).map((item) => ({ type: item.type, name: item.category }));
  }
  const policy = { normalize, key, merge, fromTransactions };
  if (typeof module !== "undefined" && module.exports) module.exports = policy;
  else root.CategoryPolicy = policy;
})(globalThis);
