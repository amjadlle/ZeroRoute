import type { IncomingMessage, ServerResponse } from "node:http";
import { handleRequest } from "../src/server.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    return await handleRequest(req, res);
  } catch (err) {
    // Log full error server-side; never expose internals to the client
    console.error("Vercel Serverless Function Exception:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: {
          message: "Internal server error"
        }
      }));
    }
  }
}
