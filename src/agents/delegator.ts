import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { WeaviateClient } from "weaviate-ts-client";
import { AgentState, ChartConfig } from "../types";
import { makeRagAgent } from "./ragAgent";
import { buildChartConfig } from "../tools/chartTool";

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
    .addNode("final", (state: DelegatorState) => {
      const synthesized =
        state.answer ||
        (state.references.length
          ? state.references.map((ref) => ref.answer).join(" ")
          : `No answer found for: ${state.query}`);

      return {
        answer: synthesized,
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
