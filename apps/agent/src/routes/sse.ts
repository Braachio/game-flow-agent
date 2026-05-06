import type { FastifyPluginAsync } from "fastify";
import { eventBus } from "../services/event-bus.js";

export const sseRoute: FastifyPluginAsync = async (app) => {
  app.get("/events/stream", async (request, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Send initial ping
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ clients: eventBus.clientCount + 1 })}\n\n`);

    const unsubscribe = eventBus.subscribe((event) => {
      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
    });

    // Keep-alive every 30s
    const keepAlive = setInterval(() => {
      reply.raw.write(`:keepalive\n\n`);
    }, 30_000);

    request.raw.on("close", () => {
      unsubscribe();
      clearInterval(keepAlive);
      console.log(`[SSE] Client disconnected (${eventBus.clientCount} remaining)`);
    });

    console.log(`[SSE] Client connected (${eventBus.clientCount} total)`);
  });
};
