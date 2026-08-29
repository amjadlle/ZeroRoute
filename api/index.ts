import type { IncomingMessage, ServerResponse } from "node:http";
import { handleRequest } from "../src/server.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    return await handleRequest(req, res);
  } catch (err) {
    console.error("Vercel Serverless Function Exception:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: {
          message: "Internal Serverless Function Error",
          details: err instanceof Error ? err.message : String(err)
        }
      }));
    }
  }
}
