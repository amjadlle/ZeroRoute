import { providers } from "../dist/providers/providers.js";

console.log("==================================================");
console.log("⚡ TESTING ALL 10 AI PROVIDERS");
console.log("==================================================\n");

async function runBenchmark() {
  const results = [];
  
  for (const p of providers) {
    process.stdout.write(`Testing ${p.name.padEnd(22)} ... `);
    const start = Date.now();
    try {
      const resp = await p.generate(
        { messages: [{ role: "user", content: "Reply with exactly: 'TEST OK'" }] },
        AbortSignal.timeout(12000)
      );
      const latencyMs = Date.now() - start;
      const preview = resp.choices[0]?.message?.content?.trim() || "";
      console.log(`✅ OK (${latencyMs}ms)`);
      results.push({
        Provider: p.name,
        Status: "✅ Working",
        Latency: `${latencyMs}ms`,
        Model: p.model,
        Reply: preview.slice(0, 30)
      });
    } catch (err) {
      const latencyMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`❌ FAILED (${latencyMs}ms)`);
      results.push({
        Provider: p.name,
        Status: "❌ Failed",
        Latency: `${latencyMs}ms`,
        Model: p.model,
        Reply: msg.slice(0, 50)
      });
    }
  }

  console.log("\n==================================================");
  console.log("📊 BENCHMARK SCORECARD");
  console.log("==================================================");
  console.table(results);
}

runBenchmark();
