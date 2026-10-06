"use strict";
const { loadConfiguration } = require("../src/config.js");
const { connectDatabase, verifySchema } = require("../src/database.js");
const {
  preflight,
  applyMigration,
  restoreMigration,
} = require("../src/migrations.js");
async function main() {
  const action = process.argv[2] || "preflight";
  if (!["preflight", "apply", "resume", "restore", "verify"].includes(action))
    throw new Error(
      "Use preflight|apply|resume <runId>|restore <runId>|verify",
    );
  const config = loadConfiguration({ purpose: "migration" }),
    { client, db } = await connectDatabase(config);
  try {
    if (action === "verify") {
      await verifySchema(db);
      console.log("Schema and owner verified");
    } else if (action === "resume" || action === "restore") {
      if (!process.argv[3]) throw new Error("Explicit runId required");
      if (process.env.CONFIRM_MIGRATION_DATABASE !== config.database)
        throw new Error(
          "Stop the application and set CONFIRM_MIGRATION_DATABASE to the exact database name",
        );
      if (action === "resume")
        console.log(
          JSON.stringify({
            runId: await applyMigration(db, null, {
              resumeId: process.argv[3],
              bootstrap: {
                ownerSam: config.values.BOOTSTRAP_OWNER_SAM,
                adminSam: config.values.BOOTSTRAP_ADMIN_SAM,
              },
            }),
            status: "verified",
          }),
        );
      else await restoreMigration(db, process.argv[3]);
      console.log(action + " completed");
    } else {
      const plan = await preflight(db, {
        ownerSam: config.values.BOOTSTRAP_OWNER_SAM,
        adminSam: config.values.BOOTSTRAP_ADMIN_SAM,
      });
      console.log(
        JSON.stringify({
          database: config.database,
          action,
          changed: plan.changed,
          counts: Object.fromEntries(
            Object.entries(plan.before).map(([n, rows]) => [n, rows.length]),
          ),
        }),
      );
      if (action === "apply") {
        if (process.env.CONFIRM_MIGRATION_DATABASE !== config.database)
          throw new Error(
            "Stop the application and set CONFIRM_MIGRATION_DATABASE to the exact database name",
          );
        const runId = await applyMigration(db, plan);
        console.log(JSON.stringify({ runId, status: "verified" }));
      }
    }
  } finally {
    await client.close();
  }
}
main().catch((e) => {
  console.error(
    "Migration refused:",
    /Duplicate|Malformed|Explicit|Migration|Database|Unknown|Stop|must|Missing|Invalid|requires|DevOps/.test(
      e.message,
    )
      ? e.message
      : "Database operation failed; inspect restricted server diagnostics",
  );
  process.exitCode = 1;
});
