export default async function handler(req, res) {
  try {
    const mod = await import("./dist/server.js").catch(() => import("./src/server.js"));
    const fn = mod.default || mod.handleRequest;
    return await fn(req, res);
  } catch (err) {
    console.error("ZeroRoute Vercel Server Handler Error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "Internal Server Error",
        message: err instanceof Error ? err.message : String(err)
      }));
    }
  }
}
