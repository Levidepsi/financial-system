import { createClient } from "@supabase/supabase-js";

const $ = selector => document.querySelector(selector);
const page = document.body.dataset.page;
const status = $("#auth-status");
const form = $("#access-form");
let client;
let config;
let busy = false;
let recovering = new URL(location.href).searchParams.has("recovery");
let activationState = document.body.dataset.activationState;

async function api(route, body, session) {
  const response = await fetch(`/api/${route}`, { method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify(body || {}) });
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error || "Please try again."); error.status = response.status; throw error; }
  return result;
}
function authView() { $("#purchase-section").hidden = true; $("#auth-section").hidden = false; }
function activationView(state) {
  activationState = state;
  authView();
  form.hidden = state !== "ready";
  $("#confirm-label").hidden = false;
  $("#access-confirm").required = true;
  $("#access-password").autocomplete = "new-password";
  $("#access-submit").textContent = "Activate lifetime access";
  const states = {
    ready: ["Activate your Perfi account", "Create your account once, then log in anytime. Your activation session is available for 24 hours."],
    used: ["Already Used", "This activation session has already created an account. Log in with your email and password; you do not need to activate again."],
    expired: ["Activation session expired", "This activation session has expired and cannot be renewed by refreshing. If you already registered, log in. Otherwise, reopen your delivery link in a fresh browser session."],
    unavailable: ["Activation is being prepared", "Please try again later. Existing customers can log in normally."],
    access_required: ["Lifetime access required", "This account does not have lifetime access. If you just registered, try logging in again."],
  };
  const [title, description] = states[state] || states.expired;
  $("#auth-title").textContent = title;
  $("#auth-description").textContent = description;
}
async function enter(session, notify = false) {
  await api("auth/session", {}, session);
  if (notify) {
    // Keepalive allows the existing login notification to finish across navigation.
    void fetch("/api/auth/login-notification", { method: "POST", keepalive: true,
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" } }).catch(() => {});
  }
  location.replace("/dashboard");
}
async function perform(formNode, task) {
  if (busy) return;
  busy = true;
  const controls = [...formNode.querySelectorAll("input, button")];
  controls.forEach(node => { node.disabled = true; });
  formNode.setAttribute("aria-busy", "true");
  try { await task(); }
  catch (error) { status.textContent = error.message; }
  finally { busy = false; controls.forEach(node => { node.disabled = false; }); formNode.removeAttribute("aria-busy"); }
}
form.addEventListener("submit", event => {
  event.preventDefault();
  void perform(form, async () => {
    const credentials = { email: $("#access-email").value.trim(), password: $("#access-password").value };
    if (page === "activate") {
      if (credentials.password !== $("#access-confirm").value) throw new Error("Passwords do not match.");
      status.textContent = "Activating your lifetime access…";
      try { await api("activation/register", { ...credentials, confirmPassword: $("#access-confirm").value }); }
      catch (error) {
        if ([409, 410].includes(error.status)) {
          const session = await api("activation/session");
          if (session.state !== "ready") activationView(session.state);
        }
        throw error;
      }
      status.textContent = "Lifetime access activated. Signing you in…";
    } else status.textContent = "Signing in…";
    const { data, error } = await client.auth.signInWithPassword(credentials);
    if (error) throw error;
    if (!data.session) throw new Error("Account ready. Please log in to continue.");
    await enter(data.session, true);
  });
});
$("#access-forgot").addEventListener("click", () => {
  form.hidden = true; $("#access-recovery").hidden = false;
  $("#access-forgot").hidden = true; status.textContent = "Enter your email to receive a password reset link.";
});
$("#access-recovery").addEventListener("submit", event => {
  event.preventDefault();
  void perform(event.currentTarget, async () => {
    const { error } = await client.auth.resetPasswordForEmail($("#reset-email").value.trim(), { redirectTo: `${location.origin}/login?recovery=1` });
    if (error) throw error;
    status.textContent = "If an account exists, a reset link has been sent. Open it in this browser.";
  });
});
$("#access-new-password").addEventListener("submit", event => {
  event.preventDefault();
  void perform(event.currentTarget, async () => {
    if ($("#reset-password").value !== $("#reset-confirm").value) throw new Error("Passwords do not match.");
    const { error } = await client.auth.updateUser({ password: $("#reset-password").value });
    if (error) throw error;
    const { data } = await client.auth.getSession();
    if (data.session) await api("auth/logout", {}, data.session);
    await client.auth.signOut({ scope: "local" });
    location.replace("/login");
  });
});
$("#access-logout").addEventListener("click", async () => {
  const { data } = await client.auth.getSession();
  try { if (data.session) await api("auth/logout", {}, data.session); }
  finally { await client.auth.signOut({ scope: "local" }); location.replace("/login"); }
});
async function initialize() {
  if (page !== "home") { authView(); form.hidden = page !== "login"; $("#access-forgot").hidden = page !== "login"; }
  if (page === "activate") activationView(activationState || "unavailable");
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) throw new Error("Account services are unavailable. Please try again.");
    config = await response.json();
    if (config.productUrl) { $("#purchase-link").href = config.productUrl; $("#purchase-link").hidden = false; }
    else $("#purchase-unavailable").hidden = false;
    if (!config.configured) throw new Error("Sign-in is being configured. Please try again later.");
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (recovering) {
      authView(); form.hidden = true; $("#access-forgot").hidden = true;
      if (data.session && !new URL(location.href).searchParams.has("error")) {
        $("#access-new-password").hidden = false; status.textContent = "Choose your new password.";
      } else { $("#access-recovery").hidden = false; status.textContent = "This reset link could not be verified. Request a new link."; }
      history.replaceState(null, "", "/login");
      return;
    }
    if (data.session) {
      $("#access-logout").hidden = false;
      try { await enter(data.session); return; }
      catch (error) {
        if (error.status === 401) await client.auth.signOut({ scope: "local" });
        else if (error.status === 403) { authView(); form.hidden = true; status.textContent = error.message; return; }
        else throw error;
      }
    }
    if (page === "activate" && config.accessEnabled) activationView((await api("activation/session")).state);
    else if (page === "activate") activationView("unavailable");
  } catch (error) { authView(); status.textContent = error.message; }
}
void initialize();
