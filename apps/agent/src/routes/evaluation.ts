import type { FastifyPluginAsync } from "fastify";
import type { EvaluationMetrics, UserFeedback, FalseNegativeEvent } from "@likelion/shared";
import { eventRepository } from "../services/event-repository.js";

export const evaluationRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { sessionId?: string } }>(
    "/events/evaluation",
    async (request): Promise<EvaluationMetrics> => {
      return eventRepository.getEvaluation(request.query.sessionId);
    }
  );

  app.post<{ Body: { eventId: string; feedback: UserFeedback } }>(
    "/events/feedback",
    async (request, reply) => {
      const { eventId, feedback } = request.body;
      if (!eventId) {
        reply.status(400);
        throw new Error("eventId is required");
      }
      const event = await eventRepository.markFeedback(eventId, feedback);
      if (!event) {
        reply.status(404);
        throw new Error("Event not found");
      }
      console.log(`[Eval] Event ${eventId} marked as: ${feedback}`);
      return { event };
    }
  );

  app.post<{ Body: { sessionId?: string; note?: string } }>(
    "/events/false-negative",
    async (request): Promise<FalseNegativeEvent> => {
      const { sessionId, note } = request.body;
      const fn = await eventRepository.addFalseNegative(sessionId, note);
      console.log(`[Eval] False negative recorded: ${fn.id}${note ? ` — "${note}"` : ""}`);
      return fn;
    }
  );
};
