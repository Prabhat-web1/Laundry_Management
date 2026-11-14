#!/usr/bin/env node
/*
 * Network diagnostic for the Neon connection. Uses only Node built-ins, changes nothing,
 * and never prints the password.
 *
 *   node --env-file=.env scripts/diagnose-network.js
 *
 * Run it once on regular Wi-Fi and once on the hotspot, then compare the output.
 */
const dns = require("node:dns");
const net = require("node:net");
const tls = require("node:tls");

function parse(name) {
  const raw = process.env[name];
  if (!raw) return null;
  try { const u = new URL(raw); return { name, host: u.hostname, port: Number(u.port) || 5432 }; } catch { return null; }
}
const targets = [parse("DATABASE_URL"), parse("DIRECT_URL")].filter(Boolean);
if (!targets.length) { console.error("DATABASE_URL / DIRECT_URL not found. Run with: node --env-file=.env scripts/diagnose-network.js"); process.exit(1); }

const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(`${label} timed out after ${ms}ms`)), ms))]);

function tcp(host, port, family) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.connect({ host, port, family, timeout: 6000 });
    socket.once("connect", () => { socket.destroy(); resolve(`OPEN (${Date.now() - started}ms)`); });
    socket.once("timeout", () => { socket.destroy(); resolve("TIMEOUT  -> packets dropped (firewall / blocked port / no route)"); });
    socket.once("error", (e) => resolve(`ERROR ${e.code || e.message}`));
  });
}

// PostgreSQL SSLRequest: 8 bytes. A reachable server answers 'S'. Proves a real Postgres is on the other end.
function sslProbe(host, port, family) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, family, timeout: 6000 });
    socket.once("connect", () => socket.write(Buffer.from([0, 0, 0, 8, 4, 210, 22, 47])));
    socket.once("data", (d) => { socket.destroy(); resolve(d.toString() === "S" ? "server answered 'S' (TLS supported)" : `unexpected reply "${d.toString()}"`); });
    socket.once("timeout", () => { socket.destroy(); resolve("no reply (timeout)"); });
    socket.once("error", (e) => resolve(`ERROR ${e.code || e.message}`));
  });
}

async function resolveWith(label, resolver, host) {
  const out = {};
  for (const type of ["resolve4", "resolve6"]) {
    try { out[type] = await withTimeout(resolver[type](host), 5000, label); }
    catch (e) { out[type] = `${e.code || e.message}`; }
  }
  console.log(`  ${label.padEnd(22)} A: ${[].concat(out.resolve4).join(", ")}   AAAA: ${[].concat(out.resolve6).join(", ")}`);
  return out;
}

(async () => {
  console.log("Node", process.version);
  const proxies = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"].filter((k) => process.env[k]);
  console.log("Proxy env vars set:", proxies.length ? proxies.join(", ") + "  (Postgres does NOT go through HTTP proxies)" : "none");
  console.log("System DNS servers:", dns.getServers().join(", ") || "unknown");

  const seen = new Set();
  for (const t of targets) {
    if (seen.has(t.host)) continue;
    seen.add(t.host);
    console.log(`\n== ${t.name}  host=${t.host}  port=${t.port}`);

    console.log("DNS:");
    let sys = {};
    try { sys.resolve4 = (await dns.promises.lookup(t.host, { all: true, family: 4 })).map((a) => a.address); } catch (e) { sys.resolve4 = e.code; }
    try { sys.resolve6 = (await dns.promises.lookup(t.host, { all: true, family: 6 })).map((a) => a.address); } catch (e) { sys.resolve6 = e.code; }
    console.log(`  ${"system resolver".padEnd(22)} A: ${[].concat(sys.resolve4).join(", ")}   AAAA: ${[].concat(sys.resolve6).join(", ")}`);
    const cf = new dns.promises.Resolver(); cf.setServers(["1.1.1.1"]);
    const g = new dns.promises.Resolver(); g.setServers(["8.8.8.8"]);
    const viaCf = await resolveWith("Cloudflare 1.1.1.1", cf, t.host);
    await resolveWith("Google 8.8.8.8", g, t.host);

    const v4 = Array.isArray(viaCf.resolve4) ? viaCf.resolve4[0] : null;
    console.log("TCP + Postgres handshake:");
    console.log(`  by hostname, forced IPv4 : ${await tcp(t.host, t.port, 4)}`);
    console.log(`  by hostname, forced IPv6 : ${await tcp(t.host, t.port, 6)}`);
    if (v4) console.log(`  direct to ${v4} (bypasses your DNS): ${await tcp(v4, t.port, 4)}`);
    console.log(`  Postgres SSL probe (IPv4): ${await sslProbe(t.host, t.port, 4)}`);
  }

  console.log(`\nHow to read this:
  * DNS shows ERROR/ENOTFOUND on system resolver but addresses on 1.1.1.1  -> your Wi-Fi's DNS is the problem.
  * DNS fine, TCP TIMEOUT on port 5432 for IPv4 and the hotspot is OPEN      -> the Wi-Fi network blocks outbound 5432.
  * IPv6 TIMEOUT but IPv4 OPEN                                                -> broken IPv6 route; disable IPv6 on that adapter.
  * TCP OPEN but SSL probe fails                                              -> a middlebox is intercepting the traffic.`);
})();
