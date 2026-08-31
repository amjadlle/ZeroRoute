/**
 * Static file routes.
 *
 * Serves the landing page, dashboard, widget, and public assets from public/.
 * All HTML/JS lives on disk — no TypeScript string bundles.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import fs   from "node:fs";
import path from "node:path";
import { sendJson, getCorsHeaders } from "../utils/http.js";

/**
 * Reads a file from the public/ directory and writes it to the response.
 * Returns true on success, false if the file doesn't exist.
 */
export const servePublicFile = (
  res:          ServerResponse,
  filename:     string,
  contentType:  string,
  cacheSeconds  = 0,
  requestOrigin?: string
): boolean => {
  try {
    const filePath = path.join(process.cwd(), "public", filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, {
        "Content-Type": contentType,
        ...(cacheSeconds > 0 ? { "Cache-Control": `public, max-age=${cacheSeconds}` } : {}),
        ...getCorsHeaders(requestOrigin)
      });
      res.end(content);
      return true;
    }
  } catch (err) {
    console.error(`[ZeroRoute] Failed to serve public/${filename}:`, err);
  }
  return false;
};

export const handleStaticRoutes = (
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): boolean => {
  if (req.method !== "GET") return false;
  const origin = req.headers.origin as string | undefined;

  // Logo, knowledge base & persona (markdown) — cached long-term
  if (url === "/logo.png" || url === "/public/logo.png") {
    return servePublicFile(res, "logo.png", "image/png", 86400, origin);
  }
  if (url === "/knowledge.md" || url === "/public/knowledge.md") {
    return servePublicFile(res, "knowledge.md", "text/markdown; charset=utf-8", 300, origin);
  }
  if (url === "/persona.md" || url === "/public/persona.md") {
    return servePublicFile(res, "persona.md", "text/markdown; charset=utf-8", 300, origin);
  }

  // Embeddable chatbot widget script
  if (url === "/widget.js") {
    if (!servePublicFile(res, "widget.js", "application/javascript; charset=utf-8", 300, origin)) {
      sendJson(res, 503, { error: { message: "Widget not available" } });
    }
    return true;
  }

  // Public marketing landing page — no API key embedded
  if (url === "/") {
    if (!servePublicFile(res, "index.html", "text/html; charset=utf-8", 0, origin)) {
      sendJson(res, 503, { error: { message: "Landing page not available" } });
    }
    return true;
  }

  // Admin dashboard UI
  if (url === "/app" || url === "/dashboard" || url === "/console" || url === "/admin") {
    if (!servePublicFile(res, "dashboard.html", "text/html; charset=utf-8", 0, origin)) {
      sendJson(res, 503, { error: { message: "Dashboard not available" } });
    }
    return true;
  }

  return false; // not a static route
};
