"use strict";
// Physical IISNode auth endpoint keeps the Windows-auth location after URL Rewrite.
// Same server/app/config implementation; no separate service or extra infrastructure.
const { startServer } = require("../../src/server.js");
const { loadConfiguration } = require("../../src/config.js");
if (require("../../src/entry.js").isEntrypoint(module))
  startServer({ config: { ...loadConfiguration(), jobsEnabled: false } })
    .then((runtime) => {
      const stop = () =>
        runtime.shutdown().catch(() => {
          process.exitCode = 1;
        });
      process.once("SIGTERM", stop);
      process.once("SIGINT", stop);
    })
    .catch(() => {
      console.error(
        "Makam Windows session entry refused; verify configuration and database schema",
      );
      process.exitCode = 1;
    });
