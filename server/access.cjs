const { randomBytes, createHash } = require("node:crypto");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { HttpError } = require("./validation.cjs");

const hash = value => createHash("sha256").update(value).digest("hex");
const enabled = env => env.PERFI_ACCESS_ENABLED === "true";
const secret = () => randomBytes(32).toString("hex");
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map(item => {
    const i = item.indexOf("=");
    return i < 0 ? [] : [item.slice(0, i).trim(), item.slice(i + 1)];
  }).filter(pair => pair.length === 2));
}
function cookie(name, value, env, maxAge = 365 * 86400) {
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(env.APP_URL || "");
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${local ? "" : "; Secure"}`;
}
function checked(result) {
  if (result.error) throw new HttpError(503, "Account access is temporarily unavailable. Please try again.");
  return result.data;
}
function sessionId(token) {
  // Call only AFTER Supabase getUser has verified this exact token.
  try {
    const id = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).session_id;
    return /^[a-f0-9-]{36}$/i.test(id) ? id : null;
  } catch { return null; }
}
function productUrl(env) {
  try { const url = new URL(env.RAKET_PRODUCT_URL); return url.protocol === "https:" ? url.href : null; }
  catch { return null; }
}
function createAccess({ env, database, sendRequest = fetch }) {
  async function limit(bucket, count, seconds) {
    if (!checked(await database().rpc("perfi_rate_limit", { p_bucket: bucket, p_limit: count, p_seconds: seconds }))) {
      throw new HttpError(429, "Too many activation attempts. Please wait and try again later.");
    }
  }
  async function ready() {
    const row = checked(await database().from("perfi_access_config").select("verified_at").eq("singleton", true).maybeSingle());
    if (!row?.verified_at) throw new HttpError(503, "Activation is not available yet. Please try again later.");
  }
  async function authorize(userId, sid, touch = false) {
    if (!sid) throw new HttpError(401, "Please log in again to continue.");
    const access = checked(await database().rpc("perfi_authorize", { p_user_id: userId, p_session_id: sid, p_touch: touch }));
    if (access?.status === "not_ready") throw new HttpError(503, "Account access is being prepared. Please try again later.");
    if (access?.status === "expired") throw new HttpError(401, "Your session expired after inactivity. Please log in again.");
    if (access?.status !== "active") throw new HttpError(403, "Lifetime access is required. If you already purchased Perfi, use your activation link.");
    return access;
  }
  async function webIdentity(req, touch = false) {
    const value = cookies(req).perfi_web;
    if (!/^[a-f0-9]{64}$/.test(value || "")) return null;
    const record = checked(await database().from("perfi_web_sessions").select("user_id,session_id").eq("session_hash", hash(value)).maybeSingle());
    if (!record) return null;
    await authorize(record.user_id, record.session_id, touch);
    return record;
  }
  async function bridge(req, res, user, token) {
    const sid = sessionId(token);
    await authorize(user.id, sid, true);
    // Reuse this browser's record for the same Supabase session.
    const current = cookies(req).perfi_web;
    if (/^[a-f0-9]{64}$/.test(current || "")) {
      const record = checked(await database().from("perfi_web_sessions").select("session_id,user_id").eq("session_hash", hash(current)).maybeSingle());
      if (record?.session_id === sid && record.user_id === user.id) {
        res.setHeader("Set-Cookie", cookie("perfi_web", current, env));
        return;
      }
    }
    const value = secret();
    checked(await database().from("perfi_web_sessions").insert({ session_hash: hash(value), session_id: sid, user_id: user.id }));
    res.setHeader("Set-Cookie", cookie("perfi_web", value, env));
  }
  async function logout(req, res, user, token) {
    const sid = sessionId(token);
    if (sid) {
      // A tombstone prevents an unexpired JWT from re-opening this session.
      checked(await database().from("perfi_login_activity").upsert({ session_id: sid, user_id: user.id,
        last_activity_at: new Date().toISOString(), revoked_at: new Date().toISOString() }));
      checked(await database().from("perfi_web_sessions").delete().eq("user_id", user.id).eq("session_id", sid));
    }
    res.setHeader("Set-Cookie", cookie("perfi_web", "", env, 0));
  }
  async function activation(req, res, create = false) {
    await ready();
    let value = cookies(req).perfi_activation;
    if (!value && create) {
      const ip = String(req.headers["x-vercel-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
      await limit(`activation-ip/${hash(ip)}`, 20, 3600);
      value = secret();
      checked(await database().from("perfi_activation_sessions").insert({ session_hash: hash(value) }));
      // Cookie deliberately outlives the 24h DB expiry: refresh cannot reset an expired session.
      res.setHeader("Set-Cookie", cookie("perfi_activation", value, env));
    }
    if (!/^[a-f0-9]{64}$/.test(value || "")) return { state: "missing" };
    const record = checked(await database().from("perfi_activation_sessions").select("expires_at,consumed_at,activated_user_id")
      .eq("session_hash", hash(value)).maybeSingle());
    if (!record) return { state: "expired" };
    if (record.consumed_at) return { state: "used" };
    if (Date.parse(record.expires_at) <= Date.now()) return { state: "expired" };
    return { state: "ready", hash: hash(value) };
  }
  async function register(req, res, body) {
    let identity;
    try { identity = await webIdentity(req); }
    catch (error) { if (![401, 403].includes(error.status)) throw error; }
    if (identity) throw new HttpError(409, "Your lifetime account is already active. Open your dashboard instead.");
    const active = await activation(req, res);
    if (active.state !== "ready") throw new HttpError(active.state === "used" ? 409 : 410,
      active.state === "used" ? "This activation session was already used. Log in to your account." : "This activation session is missing or expired. Log in if you already have an account.");
    await limit(`activation-submit/${active.hash}`, 10, 900);
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HttpError(400, "Enter a valid email address.");
    if (password.length < 8 || Buffer.byteLength(password) > 72) throw new HttpError(400, "Use a password of at least 8 characters and at most 72 bytes.");
    if (password !== body.confirmPassword) throw new HttpError(400, "Passwords do not match.");
    // Preserve existing email-confirmation behavior (current app uses admin-confirmed accounts).
    // The DB trigger atomically grants access and consumes the session with user creation.
    const { data, error } = await database().auth.admin.createUser({ email, password, email_confirm: true,
      app_metadata: { perfi_activation_hash: active.hash } });
    if (error) {
      const state = await activation(req, res);
      if (state.state === "used") throw new HttpError(409, "Activation already completed. Log in with your email and password.");
      if (state.state === "expired") throw new HttpError(410, "Your activation session has expired.");
      if (["email_exists", "user_already_exists"].includes(error.code)) throw new HttpError(409, "An account already exists for this email. Log in instead.");
      throw new HttpError(503, "Registration could not finish. Your activation session is still available; try again.");
    }
    if (env.RESEND_API_KEY && data?.user) {
      try {
        const response = await sendRequest("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json",
            "Idempotency-Key": `perfi-welcome/${data.user.id}` },
          body: JSON.stringify({ from: env.LOGIN_EMAIL_FROM || "Perfi <login@perfi.asia>", to: [email],
            subject: "Welcome to Perfi — Your Lifetime Access Is Ready",
            text: "Welcome to Perfi!\n\nYour account has been successfully activated.\n\nYou now have lifetime access to your personal finance dashboard.\n\nYou can log in anytime at https://perfi.asia/login.\n\nThank you for choosing Perfi!" }),
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) console.warn("Activation welcome email rejected:", response.status);
      } catch { console.warn("Activation welcome email unavailable; lifetime access is active."); }
    }
    return { activated: true, redirect: "/dashboard" };
  }
  async function page(req, res, name) {
    if (!["home", "login", "activate", "dashboard"].includes(name)) throw new HttpError(404, "Page not found.");
    const redirect = destination => { res.statusCode = 303; res.setHeader("Location", destination); res.end(""); };
    let identity = null;
    let state = "ready";
    const recovery = new URL(req.url, "https://perfi.invalid").searchParams.get("recovery") === "1";
    if (enabled(env)) {
      try { identity = await webIdentity(req, true); }
      catch (error) {
        if (error.status === 403) state = "access_required";
        else if (error.status !== 401) throw error;
      }
      if (identity && name !== "dashboard" && !recovery) return redirect("/dashboard");
      if (!identity && name === "dashboard") return redirect(state === "access_required" ? "/login?access=required" : "/login");
      if (name === "activate" && state !== "access_required") state = (await activation(req, res, true)).state;
    } else if (["home", "dashboard"].includes(name)) {
      name = "dashboard";
    } else if (name === "activate") state = "unavailable";
    const template = await readFile(path.join(__dirname, "..", name === "dashboard" ? "index.html" : "access.html"), "utf8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Vary", "Cookie");
    res.end(template.replace('data-page="home"', `data-page="${name}" data-activation-state="${state}"`)
      .replace("<body>", `<body data-access-enforced="${enabled(env)}">`));
  }
  return { authorize, bridge, logout, activation, register, page, webIdentity };
}
module.exports = { createAccess, enabled, productUrl, sessionId, hash, cookie };
