"use strict";
const { tenantDatabase, runInBase } = require("./tenancy.js");
const { createMailJobs } = require("./mail-jobs.js");
function createMultiBaseMailJobs(raw, publicUrl, transportFactory) {
  const jobs = new Map(),
    db = tenantDatabase(raw);
  let stopping = false,
    running = false;
  return {
    stop() {
      stopping = true;
      for (const worker of jobs.values()) worker.stop();
    },
    async tick() {
      if (stopping || running) return;
      running = true;
      try {
        for (const base of await raw
          .collection("bases")
          .find({ deletedAt: { $exists: false } })
          .toArray()) {
          if (stopping) break;
          const url = new URL(publicUrl);
          url.searchParams.set("makamBase", base.id);
          if (!jobs.has(base.id))
            jobs.set(
              base.id,
              createMailJobs(db, url.href, transportFactory, base.id),
            );
          await runInBase(base, () => jobs.get(base.id).tick());
        }
      } finally {
        running = false;
      }
    },
  };
}
exports.createMultiBaseMailJobs = createMultiBaseMailJobs;
