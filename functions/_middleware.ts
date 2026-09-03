/**
 * Cloudflare Pages Function Middleware.
 * Automatically catches all dynamic /v1/*, /api/*, /health, /widget.js requests
 * and routes them through the ZeroRoute Engine.
 */
import worker from "../src/worker.js";

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // If request is for dynamic ZeroRoute backend APIs
  if (
    url.pathname.startsWith("/v1/") ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/health" ||
    url.pathname === "/widget.js" ||
    url.pathname === "/knowledge.md" ||
    url.pathname === "/persona.md"
  ) {
    return worker.fetch(request, env, context);
  }

  // Otherwise, let Cloudflare Pages serve static HTML/CSS/JS from public/
  return context.next();
};
