import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { WeaviateClient } from "weaviate-ts-client";
import { AgentState, ChartConfig } from "../types";
import { makeRagAgent } from "./ragAgent";
import { buildChartConfig } from "../tools/chartTool";
import { buildGeminiModel } from "../llm/gemini";

const State = Annotation.Root({
  query: Annotation<string>(),
  tenant: Annotation<string>(),
  answer: Annotation<string | undefined>({
    reducer: (_left, right) => right,
    default: () => undefined,
  }),
  references: Annotation<AgentState["references"]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  fileIds: Annotation<string[]>({
    reducer: (left, right) => Array.from(new Set([...(left ?? []), ...(right ?? [])])),
    default: () => [],
  }),
  chartConfig: Annotation<ChartConfig | undefined>({
    reducer: (_left, right) => right,
    default: () => undefined,
  }),
  notes: Annotation<string[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
});

export type DelegatorState = typeof State.State;

const decideRoute = (state: DelegatorState) => {
  const q = state.query.toLowerCase();
  const wantsChart = /(chart|graph|plot|visual)/.test(q);
  const wantsRag = /\b(file|doc|docs|manual|kb|tenant|reference|lookup|knowledge|qa|documentation|what|how|why|where|when)\b/.test(
    q
  );

  if (wantsChart && wantsRag) return "both";
  if (wantsChart) return "chart";
  if (wantsRag) return "rag";
  return "direct";
};

const directAnswer = (state: DelegatorState): Partial<DelegatorState> => ({
  answer:
    state.answer ??
    `Direct answer (no tools): "${state.query}" – delegate suggests a concise response.`,
  notes: [`Delegate decided to answer directly.`],
});

const chartNode = (state: DelegatorState): Partial<DelegatorState> => ({
  chartConfig: buildChartConfig(state.query),
  notes: ["Chart tool used with mocked config."],
});

export const buildDelegatingGraph = (client: WeaviateClient) => {
  const ragNode = makeRagAgent(client);
  const gemini = buildGeminiModel();

  const asText = (content: unknown) => {
    if (Array.isArray(content)) {
      return content
        .map((entry) =>
          typeof entry === "string"
            ? entry
            : typeof entry === "object" && entry !== null && "text" in entry
              ? // @ts-ignore
                entry.text
              : JSON.stringify(entry)
        )
        .join(" ");
    }
    if (typeof content === "string") return content;
    if (content && typeof content === "object" && "text" in content) {
      // @ts-ignore
      return content.text as string;
    }
    return String(content ?? "");
  };

  const graph = new StateGraph(State)
    .addNode("delegate", (state: DelegatorState) => ({
      notes: [`Routing decision: ${decideRoute(state)}`],
    }))
    .addNode("direct", directAnswer)
    .addNode("chart", chartNode)
    .addNode("rag", ragNode)
    .addNode("chart_and_rag", async (state: DelegatorState) => {
      const [chartResult, ragResult] = await Promise.all([
        Promise.resolve(chartNode(state)),
        ragNode(state),
      ]);

      return {
        ...chartResult,
        ...ragResult,
        notes: [
          ...(chartResult.notes ?? []),
          ...(ragResult.notes ?? []),
          "Parallel branch: Chart + RAG.",
        ],
      };
    })
    .addNode("final", async (state: DelegatorState) => {
      const stitched =
        state.references.length > 0
          ? state.references.map((ref) => `- ${ref.answer}`).join("\n")
          : null;
      const fallback =
        state.answer ??
        stitched ??
        `No answer found for: ${state.query}. If you have access to an LLM, provide a concise response.`;

      const llmNotes: string[] = [];
      let llmAnswer = fallback;

      if (gemini) {
        const prompt = [
          "You are a concise assistant helping with a shopfloor-style Q&A.",
          `User query: ${state.query}`,
          state.chartConfig ? "A chart config is being returned; keep that in mind." : "",
          stitched ? `Context:\n${stitched}` : "No retrieval context available.",
          "Provide a short, direct answer (1-3 sentences).",
        ]
          .filter(Boolean)
          .join("\n\n");

        try {
          const res = await gemini.invoke(prompt);
          llmAnswer = asText(res.content) || fallback;
          llmNotes.push(
            `Gemini generated the final answer (${process.env.GEMINI_MODEL ?? "gemini-1.5-flash"}).`
          );
        } catch (error: any) {
          llmNotes.push(`Gemini fallback used due to error: ${error?.message ?? error}`);
        }
      } else {
        llmNotes.push("Gemini not configured; using stitched fallback.");
      }

      return {
        answer: llmAnswer,
        notes: llmNotes,
      };
    })
    .addEdge(START, "delegate")
    .addConditionalEdges("delegate", decideRoute, {
      chart: "chart",
      rag: "rag",
      both: "chart_and_rag",
      direct: "direct",
    })
    .addEdge("direct", "final")
    .addEdge("chart", "final")
    .addEdge("rag", "final")
    .addEdge("chart_and_rag", "final")
    .addEdge("final", END)
    .compile();

  return graph;
};
