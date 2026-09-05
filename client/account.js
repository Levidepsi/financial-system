import { createClient } from "@supabase/supabase-js";

const dialog = document.querySelector("#account-dialog");
const message = document.querySelector("#account-message");
let client;
let config;
let user = null;
let account = null;
let mode = "loading";
let generation = 0;
let saving = false;
let refreshing = false;
let billingBusy = false;

function publish() {
  document.dispatchEvent(new CustomEvent("monea:account", { detail: { mode, account, user } }));
  render();
}

function render() {
  document.querySelector("#profile-name").textContent = user?.email || "Financial User";
  document.querySelector("#profile-plan").textContent = mode === "loading" ? "Loading account…"
    : account?.plan === "premium" ? "Premium · $5/month"
      : account?.plan === "normal" ? "Normal · $1/month" : user ? "No active subscription" : "Local demo";
  document.querySelector("#sign-in-form").hidden = !config?.configured || Boolean(user);
  document.querySelector("#sign-out").hidden = !user;
  document.querySelector("#refresh-account").hidden = !user;
  document.querySelector("#manage-subscription").hidden = !account?.hasCustomer;
  document.querySelector("#manage-subscription").disabled = billingBusy || !config?.billingConfigured;
  document.querySelectorAll("[data-subscribe]").forEach((button) => {
    const current = account?.plan === button.dataset.subscribe;
    button.disabled = billingBusy || !config?.billingConfigured || mode !== "account" || current;
    button.textContent = current ? "Current plan" : `Choose ${button.dataset.subscribe === "normal" ? "Normal" : "Premium"}`;
  });
}

async function request(path, options = {}) {
  const expected = generation;
  const { data, error } = await client.auth.getSession();
  if (error || !data.session || expected !== generation) throw new Error("Sign in to continue.");
  const response = await fetch(`/api/${path}`, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
  });
  const payload = await response.json();
  if (expected !== generation) throw new Error("Your account changed. Please try again.");
  if (!response.ok) {
    if (response.status === 401) {
      await client.auth.signOut({ scope: "local" });
    }
    const failure = new Error(payload.error || "The request failed.");
    failure.status = response.status;
    throw failure;
  }
  return payload;
}

async function refresh() {
  if (!user || refreshing || saving) return;
  const expected = generation;
  refreshing = true;
  try {
    const next = await request("account");
    if (expected !== generation) return;
    account = next;
    mode = "account";
    message.textContent = `${user.email}. ${account.plan === "none" ? "Choose a plan to add entries. Your account starts with an empty ledger; you can import a CSV after subscribing." : "Your subscription and financial data are synced to your account."}`;
    publish();
  } catch (error) {
    if (expected === generation) message.textContent = error.message;
    throw error;
  } finally {
    if (expected === generation) refreshing = false;
  }
}

function acceptSession(session) {
  const nextUser = session?.user || null;
  if (nextUser?.id === user?.id && mode !== "loading") return;
  generation += 1;
  user = nextUser;
  account = null;
  mode = user ? "loading" : "guest";
  saving = false;
  refreshing = false;
  message.textContent = user ? "Loading your account…" : "Sign in by email to subscribe and sync your data across devices.";
  publish();
  // Keep asynchronous auth calls outside Supabase's auth-state lock.
  if (user) setTimeout(() => { void refresh().catch(() => {}); }, 0);
}

window.MoneaAccount = {
  get mode() { return mode; },
  get identity() { return user?.id || "guest"; },
  get plan() { return account?.plan || "none"; },
  open() { dialog.showModal(); },
  refresh,
  async save(transactions) {
    if (mode !== "account") throw new Error("Wait for your account to finish loading.");
    if (saving || refreshing) throw new Error("An account update is in progress. Please try again.");
    const expected = generation;
    saving = true;
    try {
      const next = await request("transactions", { method: "PUT", body: JSON.stringify({ transactions, revision: account.revision }) });
      if (expected !== generation) throw new Error("Your account changed. Please try again.");
      account = { ...account, ...next };
      publish();
      try { localStorage.setItem("monea-account-update", JSON.stringify({ userId: user.id, nonce: crypto.randomUUID() })); } catch { /* Polling still refreshes other sessions. */ }
    } catch (error) {
      if (expected === generation && error.status === 409) {
        saving = false;
        await refresh();
      }
      throw error;
    } finally {
      if (expected === generation) saving = false;
    }
  },
};

document.querySelectorAll("[data-open-account]").forEach((button) => button.addEventListener("click", () => dialog.showModal()));
document.querySelector("#close-account").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
document.querySelector("#sign-in-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    const { error } = await client.auth.signInWithOtp({
      email: document.querySelector("#account-email").value.trim(),
      options: { emailRedirectTo: `${location.origin}/` },
    });
    if (error) throw error;
    message.textContent = "Check your email for a sign-in link. Open it in this browser to continue.";
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
});
document.querySelector("#sign-out").addEventListener("click", async () => {
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) message.textContent = error.message;
});
document.querySelector("#refresh-account").addEventListener("click", () => { void refresh().catch(() => {}); });

async function billing(path, body) {
  if (billingBusy) return;
  billingBusy = true;
  render();
  message.textContent = "Opening secure billing…";
  try {
    const data = await request(path, { method: "POST", body: JSON.stringify(body || {}) });
    const url = new URL(data.url);
    if (url.protocol !== "https:" || !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)) throw new Error("Invalid billing link.");
    location.assign(url.href);
  } catch (error) { message.textContent = error.message; }
  finally { billingBusy = false; render(); }
}

document.querySelectorAll("[data-subscribe]").forEach((button) => button.addEventListener("click", () => {
  void billing(account?.plan !== "none" ? "billing/portal" : "billing/checkout", { plan: button.dataset.subscribe });
}));
document.querySelector("#manage-subscription").addEventListener("click", () => { void billing("billing/portal"); });
window.addEventListener("storage", (event) => {
  if (event.key !== "monea-account-update" || !user) return;
  try { if (JSON.parse(event.newValue)?.userId === user.id) void refresh().catch(() => {}); } catch { /* Ignore malformed notifications. */ }
});
window.addEventListener("online", () => { void refresh().catch(() => {}); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) void refresh().catch(() => {}); });
setInterval(() => { if (!document.hidden) void refresh().catch(() => {}); }, 30000);

async function initialize() {
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) throw new Error("Account services are unavailable. Your local demo is still available.");
    config = await response.json();
    if (!config.configured) throw new Error("Subscriptions are not available yet. Your local demo is still available.");
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    });
    client.auth.onAuthStateChange((_event, session) => { acceptSession(session); });
    const { error } = await client.auth.getSession();
    if (error) throw error;
    const billingReturn = new URL(location.href).searchParams.get("billing");
    if (billingReturn) {
      dialog.showModal();
      message.textContent = billingReturn === "success"
        ? "Checkout finished. Waiting for payment confirmation; use Refresh status if your plan has not updated yet."
        : billingReturn === "canceled" ? "Checkout was canceled. Your plan has not changed." : "Checking your subscription…";
      const url = new URL(location.href);
      url.searchParams.delete("billing");
      history.replaceState(null, "", url);
    }
  } catch (error) {
    if (!user) mode = "guest";
    message.textContent = error.message;
    publish();
  }
  render();
}

void initialize();
