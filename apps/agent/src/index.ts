import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoute } from "./routes/health.js";
import { voiceRoute } from "./routes/voice.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
app.register(healthRoute);
app.register(voiceRoute);

const PORT = Number(process.env.PORT) || 3001;

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Agent server running on http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
