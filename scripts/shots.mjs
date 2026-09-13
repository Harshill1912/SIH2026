/**
 * Capture real screenshots of the running app for the submission PDF.
 *
 * Uses headless Chrome over the DevTools Protocol with Node's built-in
 * WebSocket, so there is nothing to install. Signs in per role by replaying the
 * app's own session cookie, so every shot is of genuinely authenticated pages.
 *
 *   node scripts/shots.mjs            # 1440x900 @2x into ./screenshots
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE = "http://localhost:3000";
const OUT = path.resolve("screenshots");
const PORT = 9333;
const W = 1440;
const H = 900;
const SCALE = 2;

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  process.env.LOCALAPPDATA + "/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => p && existsSync(p));

if (!CHROME) {
  console.error("No Chrome or Edge found.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Sign in through the real API and return the session cookie value. Cached to
 * disk between runs, because /api/auth/login is rate limited and re-running
 * this script would otherwise trip its own limiter.
 */
const CACHE = path.join(os.tmpdir(), "em-shot-sessions.json");
const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};

async function sessionCookie(email) {
  // A reseed invalidates old sessions, so confirm a cached one still works.
  if (cache[email]) {
    const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: `em_session=${cache[email]}` } });
    if (me.ok) return cache[email];
  }
  const value = await login(email);
  cache[email] = value;
  await writeFile(CACHE, JSON.stringify(cache));
  return value;
}

async function login(email) {
  let res;
  for (;;) {
    res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "demo1234" }),
    });
    if (res.status !== 429) break;
    const retry = Number(res.headers.get("retry-after") ?? 60);
    console.log(`login rate limited; waiting ${retry}s`);
    await sleep((retry + 2) * 1000);
  }
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
  const raw = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie")];
  const m = /em_session=([^;]+)/.exec(raw.join(";"));
  if (!m) throw new Error(`no session cookie for ${email}`);
  return m[1];
}

/** Minimal CDP client over one WebSocket. */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data);
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", rej, { once: true });
    });
    return new Cdp(ws);
  }
}

async function main() {
  // Clear old captures only — the folder also holds hand-written captions.
  await mkdir(OUT, { recursive: true });
  for (const f of await readdir(OUT)) {
    if (f.endsWith(".png")) await rm(path.join(OUT, f), { force: true });
  }

  const admin = await sessionCookie("admin@metrology.gov.in");
  const biz = await sessionCookie("owner@abctraders.in");
  const officer = await sessionCookie("rajesh.kumar@metrology.gov.in");
  const gatc = await sessionCookie("verify@precisiontestlabs.in");

  const tokens = await (await fetch(`${BASE}/api/demo-tokens`)).json();

  const api = (cookie, url, init = {}) =>
    fetch(`${BASE}${url}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        cookie: `em_session=${cookie}`,
        ...init.headers,
      },
    }).then((r) => r.json());

  // The seed leaves every case closed, so the officer and test-centre queues
  // photograph as empty states. File three fresh applications and dispatch
  // them — two to the officer, one to the test centre.
  const dispatch = [
    { instrumentId: "inst-scale-001", to: { assignedOfficerId: "user-officer-01" }, inDays: 1 },
    { instrumentId: "inst-ps-088", to: { assignedOfficerId: "user-officer-01" }, inDays: 3 },
    { instrumentId: "inst-wb-002", to: { assignedCentreId: "gatc-precision-labs" }, inDays: 2 },
  ];
  for (const { instrumentId, to, inDays } of dispatch) {
    const filed = await api(biz, "/api/applications", {
      method: "POST",
      body: JSON.stringify({ instrumentId }),
    });
    if (!filed.success) {
      console.log(`  ${instrumentId}: ${filed.error}`);
      continue;
    }
    const when = new Date();
    when.setDate(when.getDate() + inDays);
    when.setHours(10, 30, 0, 0);
    const assigned = await api(admin, "/api/applications", {
      method: "PATCH",
      body: JSON.stringify({
        applicationId: filed.application.id,
        scheduledFor: when.toISOString(),
        ...to,
      }),
    });
    console.log(`  ${filed.application.applicationNumber} → ${assigned.success ? "dispatched" : assigned.error}`);
  }

  /**
   * Drive the officer's inspection form: open the first case, apply three
   * standard weights and type readings that sit inside the OIML R76 band, so
   * the shot shows the computed error / MPE / verdict rather than an empty
   * form. Each step is a separate expression because React has to re-render
   * between them.
   */
  const clickText = (text) => `(() => {
    const b = [...document.querySelectorAll("button")].find(
      (el) => el.innerText.trim() === ${JSON.stringify(text)});
    if (b) b.click();
    return !!b;
  })()`;

  const setReading = (label, value) => `(() => {
    const el = document.querySelector('input[aria-label="Reading for ${label}"]');
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, "${value}");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`;

  const fillInspection = [
    `(() => {
      const b = [...document.querySelectorAll("button")].find((el) => /APP-\\d{4}-/.test(el.innerText));
      if (b) b.click();
      return !!b;
    })()`,
    clickText("500 g"),
    clickText("5 kg"),
    clickText("20 kg"),
    setReading("500 g", "500.3"),
    setReading("5 kg", "5000.8"),
    setReading("20 kg", "20001.2"),
  ];

  // Revoke one real certificate so the withdrawal screen has something to
  // show. Restored at the end of the run, so the demo is left as it was.
  const insts = await api(biz, "/api/instruments");
  const revokable = insts.instruments?.find((i) => i.latestCertificate?.token);
  const revokedCert = revokable?.latestCertificate;
  if (revokedCert) {
    const r = await api(admin, "/api/certificates/revoke", {
      method: "POST",
      body: JSON.stringify({
        certificateId: revokedCert.id,
        reason: "Instrument found with a broken lead seal during a market inspection.",
      }),
    });
    console.log(`  ${r.success ? r.message : r.error}`);
  }

  /** Document-space bounds of the HQ risk panel, padded, for a cropped shot. */
  const riskCard = `(() => {
    const h = [...document.querySelectorAll("h2")].find((el) => el.innerText.startsWith("Enforcement intelligence"));
    const card = h && h.closest(".card");
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return { x: r.left + scrollX - 16, y: r.top + scrollY - 16, width: r.width + 32, height: r.height + 32 };
  })()`;

  const shots = [
    ["01-public-verify", `${BASE}/verify`, null],
    ["02-certificate-genuine", `${BASE}/verify/${tokens.validToken}`, null],
    ["03-certificate-expired", `${BASE}/verify/${tokens.expiredToken}`, null],
    ["04-certificate-tampered", `${BASE}/verify/${tokens.tamperedToken}`, null],
    revokedCert && ["05-certificate-revoked", `${BASE}/verify/${revokedCert.token}`, null],
    ["06-business-dashboard", `${BASE}/`, biz],
    ["07-admin-assignment-desk", `${BASE}/`, admin],
    ["08-officer-field-view", `${BASE}/`, officer],
    ["09-officer-inspection-form", `${BASE}/`, officer, fillInspection],
    ["10-testcentre-gatc", `${BASE}/`, gatc],
    ["11-search", `${BASE}/search?q=SCALE`, admin],
    ["12-sticker-sheet", `${BASE}/sticker/${tokens.validToken}`, officer],
    ["13-login", `${BASE}/login`, null],
    ["14-register", `${BASE}/register`, null],
    ["15-ai-likely-to-fail", `${BASE}/`, admin, null, riskCard],
    ["16-ai-inspections-to-review", `${BASE}/`, admin, [clickText("Inspections to review · 2")], riskCard],
  ].filter(Boolean);

  // The dev server compiles a route the first time it is asked for, and a
  // half-compiled page screenshots as spinners. Ask for every route up front.
  process.stdout.write("warming routes");
  for (const [, url, cookie] of shots) {
    await fetch(url, { headers: cookie ? { cookie: `em_session=${cookie}` } : {} }).catch(() => {});
    process.stdout.write(".");
  }
  console.log(" done");

  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--window-size=${W},${H}`,
    "--hide-scrollbars",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=" + path.join(OUT, ".chrome"),
    "about:blank",
  ]);
  chrome.stderr.on("data", () => {});

  // Wait for the debugging endpoint.
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      wsUrl = v.webSocketDebuggerUrl;
    } catch {
      await sleep(500);
    }
  }
  if (!wsUrl) throw new Error("Chrome did not expose a debugging endpoint");

  const browser = await Cdp.connect(wsUrl);
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = await Cdp.connect(list.find((t) => t.id === targetId).webSocketDebuggerUrl);

  await page.send("Page.enable");
  await page.send("Network.enable");
  await page.send("Runtime.enable");
  // Let the field view take a geotag: Connaught Place, where the demo shop is.
  await browser.send("Browser.grantPermissions", {
    origin: BASE,
    permissions: ["geolocation"],
  });
  await page.send("Emulation.setGeolocationOverride", {
    latitude: 28.6328,
    longitude: 77.2197,
    accuracy: 12,
  });
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: W,
    height: H,
    deviceScaleFactor: SCALE,
    mobile: false,
  });
  // Keep the dev-mode build indicator out of the shots.
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      const css = document.createElement("style");
      css.textContent = "nextjs-portal,[data-nextjs-toast]{display:none!important}";
      document.documentElement.appendChild(css);
    `,
  });

  const evaluate = async (expression) => {
    const r = await page.send("Runtime.evaluate", { expression, returnByValue: true });
    return r.result?.value;
  };

  /** Wait until the panels have finished fetching, or give up after 20s. */
  async function settled() {
    for (let i = 0; i < 40; i++) {
      const busy = await evaluate(
        `(() => { const t = document.body ? document.body.innerText : "";
          return /Loading |Checking certificate|Compiling/i.test(t); })()`,
      );
      if (busy === false) return true;
      await sleep(500);
    }
    return false;
  }

  for (const [name, url, cookie, act, clipOf] of shots) {
    await page.send("Network.clearBrowserCookies");
    if (cookie) {
      await page.send("Network.setCookie", {
        name: "em_session",
        value: cookie,
        domain: "localhost",
        path: "/",
        httpOnly: true,
      });
    }
    await page.send("Page.navigate", { url });
    await sleep(1200);
    let quiet = await settled();
    for (const step of act ?? []) {
      if ((await evaluate(step)) === false) console.log(`  (${name}: a step found nothing)`);
      await sleep(500);
    }
    if (act) quiet = await settled();
    // Settle any entrance animation before capturing.
    await evaluate("document.querySelectorAll('*').forEach(e=>e.style.animation='none')");
    // The dev-tools button lives in a shadow root that CSS cannot reach.
    await evaluate("document.querySelectorAll('nextjs-portal').forEach(e=>e.remove())");
    await sleep(400);
    const clip = clipOf ? await evaluate(clipOf) : null;
    if (clipOf && !clip) console.log(`  (${name}: element to crop not found — capturing the full page)`);
    const { data } = await page.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
    });
    await writeFile(path.join(OUT, `${name}.png`), Buffer.from(data, "base64"));
    console.log("captured", name, quiet ? "" : "(still loading — check this one)");
  }

  if (revokedCert) {
    await api(admin, "/api/certificates/revoke", {
      method: "POST",
      body: JSON.stringify({ certificateId: revokedCert.id, restore: true }),
    });
    console.log(`restored ${revokedCert.certNumber ?? "certificate"}`);
  }

  chrome.kill();
  // Windows keeps a handle on the crash-reporter file for a moment after exit.
  await sleep(1500);
  await rm(path.join(OUT, ".chrome"), { recursive: true, force: true }).catch(() => {});
  console.log("\nScreenshots in", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
