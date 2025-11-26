import type { WeaviateClient } from "weaviate-ts-client";
import { AgentReference, AgentState, CLASS_NAME } from "../types";

const shapeReferences = (payload: any[]): AgentReference[] =>
  payload.map((raw) => {
    const item = raw?.properties ?? raw;
    return {
      fileId: item.fileId ?? "unknown-file",
      question: item.question ?? "",
      answer: item.answer ?? "",
    };
  });

export const makeRagAgent = (client: WeaviateClient) => {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const where = {
      path: ["question"],
      operator: "Like" as const,
      valueText: `*${state.query.slice(0, 60)}*`,
    };

    let hits: AgentReference[] = [];
    let notes: string[] = [];

    try {
      const result = await client.graphql
        .get()
        .withClassName(CLASS_NAME)
        .withFields("fileId question answer")
        .withTenant(state.tenant)
        .withWhere(where)
        .withLimit(3)
        .do();
      hits = shapeReferences(result?.data?.Get?.[CLASS_NAME] ?? []);
    } catch (error: any) {
      notes.push(`GraphQL fallback triggered: ${error?.message ?? error}`);
    }

    // Fallback to fetchObjects API if embeddings or filtering are unavailable.
    if (!hits.length) {
      try {
        const objects = await client.data
          .getter()
          .withClassName(CLASS_NAME)
          .withTenant(state.tenant)
          .withLimit(3)
          .do();
        const payloadCandidate: any = objects as any;
        const payload =
          payloadCandidate?.objects ??
          payloadCandidate?.data ??
          payloadCandidate ??
          [];
        hits = Array.isArray(payload) ? shapeReferences(payload) : [];
        notes.push("Used fetchObjects API due to missing vector search.");
      } catch (error: any) {
        notes.push(`fetchObjects failed: ${error?.message ?? error}`);
      }
    }

    if (!hits.length) {
      return {
        answer: state.answer ?? "No matching knowledge found.",
        references: [],
        fileIds: [],
        notes,
      };
    }

    const fileIds = Array.from(new Set(hits.map((ref) => ref.fileId)));
    const stitchedAnswer = hits
      .map((ref, idx) => `${idx + 1}. ${ref.answer}`)
      .join(" ");

    return {
      answer: stitchedAnswer,
      references: hits,
      fileIds,
      notes,
    };
  };
};
