/**
 * Cloudflare Worker Native Entry Point for ZeroRoute.
 * Translates global FetchEvent to ZeroRoute request handling.
 */
import { handleRequest } from "./server.js";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // Forward global env vars to process.env if needed
    if (env) {
      for (const [k, v] of Object.entries(env)) {
        if (typeof v === "string") {
          process.env[k] = v;
        }
      }
    }

    // Direct proxy to ZeroRoute internal routing using Web standard Request/Response
    return new Promise((resolve) => {
      let statusCode = 200;
      let headersOut: Record<string, string | string[]> = {};
      let bodyChunks: Uint8Array[] = [];

      // Create lightweight simulated IncomingMessage & ServerResponse
      const socket = new Socket();
      const req = new IncomingMessage(socket);
      req.method = request.method;
      req.url = url.pathname + url.search;
      
      request.headers.forEach((val, key) => {
        req.headers[key.toLowerCase()] = val;
      });

      const res = new ServerResponse(req);
      let isStreaming = false;
      let transformStream: TransformStream<Uint8Array, Uint8Array> | null = null;

      res.writeHead = function (code: number, headers?: any) {
        statusCode = code;
        if (headers) {
          Object.assign(headersOut, headers);
        }

        // Detect SSE / Streaming responses
        const cType = String(headersOut["content-type"] || headersOut["Content-Type"] || "");
        if (cType.includes("text/event-stream")) {
          isStreaming = true;
          transformStream = new TransformStream();
          const responseHeaders = new Headers();
          for (const [k, v] of Object.entries(headersOut)) {
            if (Array.isArray(v)) v.forEach(val => responseHeaders.append(k, val));
            else if (v !== undefined) responseHeaders.set(k, String(v));
          }
          resolve(new Response(transformStream.readable, {
            status: statusCode,
            headers: responseHeaders
          }));
        }
        return res;
      };

      res.setHeader = function (name: string, value: any) {
        headersOut[name.toLowerCase()] = value;
        return res;
      };

      res.write = function (chunk: any) {
        if (chunk) {
          const encoded = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
          if (isStreaming && transformStream) {
            const writer = transformStream.writable.getWriter();
            writer.write(encoded).then(() => writer.releaseLock()).catch(() => {});
          } else {
            bodyChunks.push(encoded);
          }
        }
        return true;
      };

      (res as any).end = function (chunk?: any) {
        if (chunk) {
          const encoded = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
          if (isStreaming && transformStream) {
            const writer = transformStream.writable.getWriter();
            writer.write(encoded).then(() => writer.close()).catch(() => {});
            return res;
          } else {
            bodyChunks.push(encoded);
          }
        }

        if (isStreaming && transformStream) {
          const writer = transformStream.writable.getWriter();
          writer.close().catch(() => {});
          return res;
        }

        const totalLength = bodyChunks.reduce((acc, c) => acc + c.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const c of bodyChunks) {
          combined.set(c, offset);
          offset += c.length;
        }

        const responseHeaders = new Headers();
        for (const [k, v] of Object.entries(headersOut)) {
          if (Array.isArray(v)) {
            v.forEach(val => responseHeaders.append(k, val));
          } else if (v !== undefined) {
            responseHeaders.set(k, String(v));
          }
        }

        resolve(new Response(combined, {
          status: statusCode,
          headers: responseHeaders
        }));
        return res;
      };

      // Read request body stream if present
      if (request.body && request.method !== "GET" && request.method !== "HEAD") {
        request.arrayBuffer().then(buf => {
          handleRequest(req, res).catch(err => {
            resolve(new Response(JSON.stringify({ error: err.message }), { status: 500 }));
          });
          req.push(Buffer.from(buf));
          req.push(null);
        }).catch(() => {
          handleRequest(req, res);
        });
      } else {
        handleRequest(req, res).catch(err => {
          resolve(new Response(JSON.stringify({ error: err.message }), { status: 500 }));
        });
        req.push(null);
      }
    });
  }
};
