import "dotenv/config";
import weaviate, { WeaviateClient } from "weaviate-ts-client";
import { CLASS_NAME } from "../types";

const DEFAULT_URL = process.env.WEAVIATE_URL ?? "http://localhost:8080";

const parseUrl = (url: string) => {
  const parsed = new URL(url);
  return {
    scheme: parsed.protocol.replace(":", "") || "http",
    host: parsed.host,
  };
};

export const createWeaviateClient = (): WeaviateClient => {
  const { scheme, host } = parseUrl(DEFAULT_URL);
  return weaviate.client({ scheme, host });
};

export const ensureClassWithMultiTenancy = async (client: WeaviateClient) => {
  const classConfig = {
    class: CLASS_NAME,
    description:
      "Simple QA store with multi-tenancy; answers are plain text (no vectorizer).",
    vectorizer: "none",
    multiTenancyConfig: { enabled: true },
    properties: [
      {
        name: "fileId",
        dataType: ["text"],
        tokenization: "field",
        indexFilterable: false,
        indexSearchable: false,
        description:
          "Identifier for the source file (kept non-searchable as requested).",
      },
      {
        name: "question",
        dataType: ["text"],
        description: "Stored question text.",
      },
      {
        name: "answer",
        dataType: ["text"],
        description: "Stored answer text.",
      },
    ],
  };

  try {
    await client.schema.classGetter().withClassName(CLASS_NAME).do();
  } catch {
    await client.schema.classCreator().withClass(classConfig).do();
  }
};

export const ensureTenants = async (
  client: WeaviateClient,
  tenantNames: string[]
) => {
  const existing = await client.schema.tenantsGetter(CLASS_NAME).do();
  const missing = tenantNames.filter(
    (name) => !existing.find((tenant) => tenant.name === name)
  );
  if (missing.length) {
    await client.schema
      .tenantsCreator(CLASS_NAME, missing.map((name) => ({ name })))
      .do();
  }
};

export interface QASeedRow extends Record<string, string> {
  fileId: string;
  question: string;
  answer: string;
}

export const seedTenantData = async (
  client: WeaviateClient,
  tenant: string,
  rows: QASeedRow[]
) => {
  for (const row of rows) {
    await client.data
      .creator()
      .withClassName(CLASS_NAME)
      .withProperties(row)
      .withTenant(tenant)
      .do();
  }
};
