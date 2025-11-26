import {
  createWeaviateClient,
  ensureClassWithMultiTenancy,
  ensureTenants,
  seedTenantData,
} from "./weaviate/client";
import { DEFAULT_TENANT } from "./types";

const tenants = [DEFAULT_TENANT, "tenant-b"];

const tenantAData = [
  {
    fileId: "safety-manual",
    question: "How do I restart the conveyor after an emergency stop?",
    answer:
      "Verify the stop cause is cleared, inspect the belt, then press reset and start in that order.",
  },
  {
    fileId: "quality-checklist",
    question: "What are the three-point inspection checks for packaging?",
    answer:
      "Check barcode readability, seal integrity, and weight tolerance before palletizing.",
  },
  {
    fileId: "shift-handover",
    question: "What should the shift lead include in the handover note?",
    answer:
      "Include machine status, outstanding work orders, and any safety observations.",
  },
];

const tenantBData = [
  {
    fileId: "analytics-deck",
    question: "Which KPI tracks rework over time?",
    answer: "The rework rate KPI measures reprocessed units divided by total output.",
  },
  {
    fileId: "training-plan",
    question: "How long is the onboarding for a new operator?",
    answer: "A two-week plan with shadowing, supervised operation, and a final check ride.",
  },
];

const main = async () => {
  const client = createWeaviateClient();
  await ensureClassWithMultiTenancy(client);
  await ensureTenants(client, tenants);

  await seedTenantData(client, tenants[0], tenantAData);
  await seedTenantData(client, tenants[1], tenantBData);

  console.log("Seeded Weaviate with tenants and sample QA rows:");
  console.table([
    ...tenantAData.map((row) => ({ tenant: tenants[0], ...row })),
    ...tenantBData.map((row) => ({ tenant: tenants[1], ...row })),
  ]);
};

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
