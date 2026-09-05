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

function publish() {
  document.dispatchEvent(new CustomEvent("monea:account", { detail: { mode, account, user } }));
  render();
}

function render() {
  document.querySelector("#profile-name").textContent = user?.email || "Financial User";
  document.querySelector("#profile-plan").textContent = mode === "loading" ? "Loading account…"
    : "Free access";
  document.querySelector("#sign-in-form").hidden = !config?.configured || Boolean(user);
  document.querySelector("#sign-out").hidden = !user;
  document.querySelector("#refresh-account").hidden = !user;
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
    message.textContent = `${user.email}. All features are free. Your financial data is synced to your account.`;
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
  message.textContent = user ? "Loading your account…" : "Sign in by email to sync your data across devices. All features are free.";
  publish();
  // Keep asynchronous auth calls outside Supabase's auth-state lock.
  if (user) setTimeout(() => { void refresh().catch(() => {}); }, 0);
}

window.MoneaAccount = {
  get mode() { return mode; },
  get identity() { return user?.id || "guest"; },
  get plan() { return "free"; },
  open() { dialog.showModal(); },
  refresh,
  save(transactions) { return window.MoneaAccount.mutate("transactions", "PUT", { transactions }); },
  createCategory(category) { return window.MoneaAccount.mutate("categories", "POST", category); },
  historyReport() { return request("reports/history"); },
  async mutate(path, method, body) {
    if (mode !== "account") throw new Error("Wait for your account to finish loading.");
    if (saving || refreshing) throw new Error("An account update is in progress. Please try again.");
    const expected = generation;
    saving = true;
    try {
      const next = await request(path, { method, body: JSON.stringify({ ...body, revision: account.revision }) });
      if (expected !== generation) throw new Error("Your account changed. Please try again.");
      account = { ...account, ...next };
      publish();
      try { localStorage.setItem("monea-account-update", JSON.stringify({ userId: user.id, nonce: crypto.randomUUID() })); } catch { /* Polling still refreshes other sessions. */ }
    } catch (error) {
      if (expected === generation && [403, 409].includes(error.status)) {
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
    if (!config.configured) throw new Error("Sign-in is not configured yet. You can still use all features on this device.");
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    });
    client.auth.onAuthStateChange((_event, session) => { acceptSession(session); });
    const { error } = await client.auth.getSession();
    if (error) throw error;
    const url = new URL(location.href);
    if (url.searchParams.has("billing") || url.searchParams.has("plan")) {
      url.searchParams.delete("billing");
      url.searchParams.delete("plan");
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
