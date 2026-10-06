"use strict";
const { loadConfiguration } = require("../src/config.js");
const { connectDatabase } = require("../src/database.js");
const { initializeForTest } = require("../src/migrations.js");
async function main() {
  const config = loadConfiguration();
  if (
    config.nodeEnv !== "test" ||
    config.authMode !== "local-test" ||
    !config.initializeTest
  )
    throw new Error(
      "Explicit NODE_ENV=test, local-test, AUTO_INITIALIZE_TEST_DB=true and isolated readiness_test_* database required",
    );
  const { client, db } = await connectDatabase(config);
  try {
    await initializeForTest(db, config);
    console.log(
      "Isolated local test accounts created; database: " + config.database,
    );
  } finally {
    await client.close();
  }
}
main().catch((e) => {
  console.error("Local setup refused:", e.message);
  process.exitCode = 1;
});
