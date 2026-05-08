import type { FastifyPluginAsync } from "fastify";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { generateSpeech } from "../services/tts.service.js";

const TTS_DIR = join(process.cwd(), "data", "tts");

export const ttsRoute: FastifyPluginAsync = async (app) => {
  // Generate TTS audio from text
  app.post<{ Body: { text: string } }>("/tts/speak", async (request) => {
    const { text } = request.body;
    if (!text) throw new Error("text is required");

    const result = await generateSpeech(text);
    if (result.error) {
      return { error: result.error };
    }
    return { audioUrl: `/tts/audio/${result.filename}` };
  });

  // Serve generated audio files
  app.get<{ Params: { filename: string } }>("/tts/audio/:filename", async (request, reply) => {
    const { filename } = request.params;
    if (!filename.endsWith(".mp3")) {
      reply.status(400);
      throw new Error("Invalid file");
    }

    const filepath = join(TTS_DIR, filename);
    try {
      const data = await readFile(filepath);
      reply.header("Content-Type", "audio/mpeg");
      reply.header("Cache-Control", "public, max-age=3600");
      return reply.send(data);
    } catch {
      reply.status(404);
      throw new Error("Audio not found");
    }
  });
};
