"use strict";
const { loadConfiguration } = require("./config.js");
const { connectDatabase, verifySchema } = require("./database.js");
const { createApp } = require("./app.js");
const { createMultiBaseMailJobs } = require("./multibase-jobs.js");
async function startServer({
  config = loadConfiguration(),
  connect = connectDatabase,
} = {}) {
  if (config.production && typeof config.listenTarget !== "string")
    throw new Error("Production requires an IISNode named pipe PORT");
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 12))
    throw new Error(
      "Runtime requires Node >=22.12.0; verify approved IISNode runtime",
    );
  // Validation completes before connect, listeners, migrations or jobs.
  for (const [key, value] of Object.entries(config.values))
    if (process.env[key] === undefined) process.env[key] = value;
  let client, server, timer, jobs, inFlight;
  const running = await connect(config);
  client = running.client;
  try {
    if (config.initializeTest) {
      const { initializeForTest } = require("./migrations.js");
      await initializeForTest(running.db, config);
    }
    await verifySchema(running.db);
    const app = await createApp({ db: running.db, config });
    server = await new Promise((resolve, reject) => {
      const listening =
        typeof config.listenTarget === "string"
          ? app.listen(config.listenTarget)
          : app.listen(config.listenTarget, config.host);
      listening.once("error", reject);
      listening.once("listening", () => resolve(listening));
    });
    if (config.jobsEnabled) {
      jobs = createMultiBaseMailJobs(running.db, config.publicUrl);
      const tick = () => {
        if (!inFlight)
          inFlight = jobs
            .tick()
            .catch(() => console.error("Mail worker failed"))
            .finally(() => {
              inFlight = null;
            });
      };
      timer = setInterval(tick, 30000);
      timer.unref();
      tick();
    }
    console.log(
      JSON.stringify({
        service: "makam",
        version: "3.1.0-multibase",
        node: process.version,
        mode: config.authMode,
        database: config.database,
        listener:
          typeof config.listenTarget === "string"
            ? "IISNode named pipe"
            : "local TCP",
        jobs: config.jobsEnabled,
      }),
    );
    let stopping;
    const shutdown = () =>
      (stopping ||= (async () => {
        clearInterval(timer);
        jobs?.stop?.();
        const timeout = setTimeout(() => server.closeAllConnections?.(), 10000);
        timeout.unref();
        await new Promise((r) => server.close(r));
        clearTimeout(timeout);
        if (inFlight) await inFlight;
        await client.close();
      })());
    return { app, server, client, shutdown };
  } catch (error) {
    clearInterval(timer);
    server?.close();
    await client.close();
    throw error;
  }
}
if (require("./entry.js").isEntrypoint(module)) {
  startServer()
    .then((runtime) => {
      const stop = () =>
        runtime
          .shutdown()
          .then(() => {
            process.exitCode = 0;
          })
          .catch(() => {
            process.exitCode = 1;
          });
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    })
    .catch((error) => {
      console.error(
        "Makam startup refused:",
        error.name,
        /configuration|requires|must|required|PORT|Invalid|DevOps|setup/.test(
          error.message,
        )
          ? error.message
          : "Database/runtime initialization failed; verify the deployment configuration.",
      );
      process.exitCode = 1;
    });
}
exports.startServer = startServer;
