"use strict";
const { MongoClient } = require("mongodb");
async function connectDatabase(config) {
  const client = new MongoClient(config.mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const db = client.db(config.database);
    await db.command({ ping: 1 });
    return { client, db };
  } catch (error) {
    await client.close();
    throw error;
  }
}
async function verifySchema(db) {
  if (await db.collection("migrationRuns").findOne({ _id: "active" }))
    throw new Error(
      "Explicit migration setup is in progress; resume or restore before startup",
    );
  const settings = await db.collection("settings").findOne({ _id: "main" });
  if (
    settings?.schemaVersion !== 2 ||
    settings?.iisnodeMultibaseSchema !== 1 ||
    !(await db
      .collection("users")
      .countDocuments({ role: "owner", active: true }))
  )
    throw new Error(
      "Database setup/migration required; run the explicit preflight and apply commands before starting IIS",
    );
  const bases = await db.collection("bases").find().toArray();
  if (!bases.some((b) => b.prefix === ""))
    throw new Error("Explicit multi-base setup required");
  for (const base of bases) {
    if (!(base.prefix === "" || /^base_[a-f0-9]{32}_$/.test(base.prefix || "")))
      throw new Error("Invalid base namespace");
    const local = await db
      .collection(base.prefix + "settings")
      .findOne({ _id: "main" });
    if (local?.schemaVersion !== 2 || local.iisnodeMultibaseSchema !== 1)
      throw new Error("Explicit per-base migration required");
  }
}
exports.connectDatabase = connectDatabase;
exports.verifySchema = verifySchema;
