import "dotenv/config";
import { buildDelegatingGraph } from "./agents/delegator";
import { createWeaviateClient } from "./weaviate/client";
import { DEFAULT_TENANT } from "./types";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key.startsWith("--")) {
      const val = args[i + 1];
      out[key.replace(/^--/, "")] = val;
      i++;
    }
  }
  return out;
};

const main = async () => {
  const { query, tenant } = parseArgs();
  if (!query) {
    console.error("Usage: npm run ask -- --query \"Your question\" [--tenant tenant-a]");
    process.exit(1);
  }

  const client = createWeaviateClient();
  const graph = buildDelegatingGraph(client);

  const result = await graph.invoke({
    query,
    tenant: tenant ?? DEFAULT_TENANT,
  });

  console.log(JSON.stringify(result, null, 2));
};

main().catch((err) => {
  console.error("Run failed:", err);
  process.exit(1);
});
