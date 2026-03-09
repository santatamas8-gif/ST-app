/**
 * Load test: szimulálja 20+ egyidejű felhasználót, hogy az app ne omljon össze.
 * Használat: BASE_URL=http://localhost:3000 node scripts/load-test.js
 *           vagy: CONCURRENT=30 ROUNDS=5 node scripts/load-test.js
 *
 * Teszteli: /api/health (DB + auth kapcsolat), opcionálisan a fő oldalakat (GET).
 * Nincs bejelentkezés: a /api/dashboard 401-et ad, de a szerver terhelése megmérendő.
 */

const CONCURRENT = parseInt(process.env.CONCURRENT || "25", 10);
const ROUNDS = parseInt(process.env.ROUNDS || "3", 10);
const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const u = new URL(url, BASE_URL);
    const lib = u.protocol === "https:" ? require("https") : require("http");
    const req = lib.get(
      url.startsWith("http") ? url : `${BASE_URL}${url}`,
      { timeout: 15000, ...options },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
            ok: res.statusCode >= 200 && res.statusCode < 400,
          });
        });
      }
    );
    req.on("error", (err) => {
      resolve({
        statusCode: 0,
        durationMs: Date.now() - start,
        ok: false,
        error: err.message,
      });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({
        statusCode: 0,
        durationMs: Date.now() - start,
        ok: false,
        error: "timeout",
      });
    });
  });
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const i = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, i)];
}

async function runRound(path, label, concurrency) {
  const start = Date.now();
  const promises = Array.from({ length: concurrency }, () => request(path));
  const results = await Promise.all(promises);
  const totalMs = Date.now() - start;
  const ok = results.filter((r) => r.ok).length;
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const failures = results.filter((r) => !r.ok);
  return {
    label,
    total: results.length,
    ok,
    failed: results.length - ok,
    totalMs,
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    failures: failures.slice(0, 3).map((f) => ({ status: f.statusCode, err: f.error })),
  };
}

async function main() {
  console.log("Load test – 20+ játékos szimuláció");
  console.log("BASE_URL:", BASE_URL, "| CONCURRENT:", CONCURRENT, "| ROUNDS:", ROUNDS);
  console.log("");

  const healthResults = [];
  for (let r = 0; r < ROUNDS; r++) {
    const res = await runRound("/api/health", `Health round ${r + 1}/${ROUNDS}`, CONCURRENT);
    healthResults.push(res);
    console.log(
      `  ${res.label}: ${res.ok}/${res.total} OK, ${res.totalMs}ms total, p50=${res.p50}ms p95=${res.p95}ms`
    );
    if (res.failed > 0) {
      console.log("    Failures:", res.failures);
    }
  }

  // Összesítés
  const allOk = healthResults.reduce((s, r) => s + r.ok, 0);
  const allTotal = healthResults.reduce((s, r) => s + r.total, 0);

  console.log("");
  console.log("--- Összefoglaló ---");
  console.log(`  Összes kérés: ${allTotal} (${ROUNDS} x ${CONCURRENT})`);
  console.log(`  Sikeres: ${allOk} (${((allOk / allTotal) * 100).toFixed(1)}%)`);
  console.log(`  Sikertelen: ${allTotal - allOk}`);
  if (allOk === allTotal) {
    console.log("  Eredmény: OK – az app 20+ párhuzamos kérésre nem omlott össze.");
  } else {
    console.log("  Eredmény: FIGYELEM – volt hibás válasz. Érdemes növelni a kapacitást vagy optimalizálni.");
  }
  console.log("");
  process.exit(allOk === allTotal ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
