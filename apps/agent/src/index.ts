import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoute } from "./routes/health.js";
import { voiceRoute } from "./routes/voice.js";
import { statsRoute } from "./routes/stats.js";
import { obsRoute } from "./routes/obs.js";
import { evaluationRoute } from "./routes/evaluation.js";
import { sessionsRoute } from "./routes/sessions.js";
import { sseRoute } from "./routes/sse.js";
import { settingsRoute } from "./routes/settings.js";
import { ttsRoute } from "./routes/tts.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
app.register(healthRoute);
app.register(voiceRoute);
app.register(statsRoute);
app.register(obsRoute);
app.register(evaluationRoute);
app.register(sessionsRoute);
app.register(sseRoute);
app.register(settingsRoute);
app.register(ttsRoute);

const PORT = Number(process.env.PORT) || 3001;

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Agent server running on http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
