import "dotenv/config";
import { buildDelegatingGraph } from "./agents/delegator";
import { createWeaviateClient } from "./weaviate/client";
import { DEFAULT_TENANT } from "./types";

const logDivider = () => console.log("=".repeat(60));

const demoQueries = [
  {
    title: "Direct answer",
    query: "Say hello to the operator and acknowledge the task.",
  },
  {
    title: "RAG only",
    query: "What are the three-point inspection checks for packaging?",
  },
  {
    title: "Chart only",
    query: "Create a chart of weekly throughput for the line.",
  },
  {
    title: "Chart + RAG",
    query:
      "Create a chart and reference any onboarding documentation for new operators.",
  },
];

const main = async () => {
  const client = createWeaviateClient();
  const graph = buildDelegatingGraph(client);

  for (const demo of demoQueries) {
    logDivider();
    console.log(`Scenario: ${demo.title}`);
    console.log(`User: ${demo.query}`);

    const result = await graph.invoke({
      query: demo.query,
      tenant: DEFAULT_TENANT,
    });

    console.log("Agent response:", {
      answer: result.answer,
      fileIds: result.fileIds,
      references: result.references,
      chartConfig: result.chartConfig,
      notes: result.notes,
    });
  }

  logDivider();
};

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
