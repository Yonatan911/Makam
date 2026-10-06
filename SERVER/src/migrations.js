"use strict";
const { randomUUID, createHash } = require("node:crypto");
const { EJSON } = require("mongodb").BSON;
const { DEFAULT_SCORING, assetProfile } = require("../shared/model.js");
const { APP_NAME } = require("../shared/branding.js");
const copy = (x) => EJSON.parse(EJSON.stringify(x));
const canonical = (x) =>
  Array.isArray(x)
    ? x.map(canonical)
    : x && typeof x === "object"
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, canonical(x[k])]),
        )
      : x;
const digest = (x) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(JSON.parse(EJSON.stringify(x)))))
    .digest("hex");
const collections = ["users", "rooms", "settings"];
const sam = (value) =>
  String(value || "")
    .split("\\")
    .pop()
    .toLowerCase();
const validSam = (value) => /^[a-z0-9][a-z0-9._-]{0,63}$/.test(value);
const defaults = () => ({
  version: 1,
  schemaVersion: 2,
  appName: APP_NAME,
  accentColor: "#53b9b3",
  defaultTheme: "light",
  density: "comfortable",
  scoring: DEFAULT_SCORING,
  networks: ["שחורה", "אדומה", "עצמאית"],
  defaultSlaHours: 24,
  schedule: { enabled: false, day: 4, time: "17:00" },
  reminderDay: 4,
  reminderTime: "09:30",
  requestMailEnabled: false,
  baseMap: { imageId: null, markers: [] },
  makamBrandApplied: true,
  lightDefaultApplied: true,
});
async function preflightSingle(db, options = {}) {
  const before = {};
  for (const name of collections)
    before[name] = await db.collection(name).find().sort({ _id: 1 }).toArray();
  const after = copy(before),
    names = new Set(),
    ids = new Set();
  if (after.settings.some((s) => s._id !== "main"))
    throw new Error("Unexpected settings record; review before migration");
  for (const u of after.users) {
    const name = sam(u.username);
    if (!validSam(name) || names.has(name))
      throw new Error(
        "Duplicate or malformed legacy sAMAccountName; no writes performed",
      );
    names.add(name);
    if (
      !u.id ||
      ids.has(u.id) ||
      ![
        "owner",
        "command_admin",
        "admin",
        "technician",
        "commander",
        "viewer",
      ].includes(u.owner ? "owner" : u.role) ||
      !Array.isArray(u.roomIds)
    )
      throw new Error("Malformed legacy user; no writes performed");
    ids.add(u.id);
  }
  ids.clear();
  for (const r of after.rooms) {
    if (
      !r.id ||
      ids.has(r.id) ||
      !Array.isArray(r.assets) ||
      !Array.isArray(r.faults) ||
      !Array.isArray(r.audit) ||
      !r.plan ||
      !Array.isArray(r.plan.tables) ||
      !Number.isInteger(r.version)
    )
      throw new Error("Malformed legacy room/plan; no writes performed");
    ids.add(r.id);
    const assets = new Set();
    for (const a of r.assets) {
      if (!a.id || assets.has(a.id) || typeof a.kind !== "string")
        throw new Error("Malformed legacy asset; no writes performed");
      assets.add(a.id);
    }
    for (const field of ["points", "walls"])
      if (r.plan[field] !== undefined && !Array.isArray(r.plan[field]))
        throw new Error("Malformed plan " + field + "; no writes performed");
  }
  const current = after.settings[0];
  if (current?.schemaVersion > 2)
    throw new Error("Database schema is newer than this application");
  if (!after.users.length) {
    const owner = sam(options.ownerSam),
      admin = sam(options.adminSam);
    if (!validSam(owner) || (admin && (!validSam(admin) || admin === owner)))
      throw new Error(
        "Explicit valid owner (and distinct optional admin) required for installation",
      );
    for (const [username, role] of [
      [owner, "owner"],
      ...(admin ? [[admin, "admin"]] : []),
    ]) {
      const id = randomUUID();
      after.users.push({
        _id: id,
        id,
        username,
        name: username,
        role,
        owner: role === "owner",
        active: true,
        roomIds: [],
        preferences: {},
      });
    }
  }
  if (!after.settings.length)
    after.settings.push({
      _id: "main",
      baseName: "הבסיס",
      freshnessDays: 7,
      note: "",
      round: null,
      demo: false,
      remindersEnabled: false,
      recipients: [],
      ...defaults(),
    });
  else if ((current.schemaVersion || 1) < 2) {
    after.settings[0] = { ...defaults(), ...current, schemaVersion: 2 };
    for (const u of after.users) {
      u.username = sam(u.username);
      u.role = u.owner ? "owner" : u.role;
      u.email ||= "";
      u.preferences ||= {};
      delete u.preferences.hideGreeting;
      delete u.rank;
    }
    for (const r of after.rooms) {
      r.requests ||= [];
      r.mailEvents ||= [];
      r.type = r.type === "חד״ן" ? "חד״ן" : "חמ״ל";
      r.plan = {
        ...r.plan,
        points: r.plan.points || [],
        walls: r.plan.walls || [],
        tables: r.plan.tables.map((t) => ({
          ...t,
          rotation: t.rotation || 0,
          shape: t.shape || "rectangle",
        })),
      };
      r.assets = r.assets.map((a) => ({
        ...a,
        phone: assetProfile(a.kind).phone ? a.phone : "",
        ip: assetProfile(a.kind).ip ? a.ip : "",
        network: assetProfile(a.kind).network ? a.network : "",
        backupIds:
          a.dependency === "redundancy" && a.parentId
            ? [a.parentId]
            : a.backupIds || [],
        parentId: a.dependency === "redundancy" ? null : a.parentId,
        dependency: a.dependency === "redundancy" ? "none" : a.dependency,
        rotation: a.rotation || 0,
      }));
      delete r.zone;
    }
  }
  const s = after.settings[0];
  if (!s.makamBrandApplied) {
    s.appName = APP_NAME;
    s.makamBrandApplied = true;
    s.version++;
  }
  if (!s.lightDefaultApplied) {
    s.defaultTheme = "light";
    s.lightDefaultApplied = true;
    s.version++;
  }
  if (!after.users.some((u) => u.role === "owner" && u.active))
    throw new Error("Database must retain an active protected owner");
  return {
    before,
    after,
    fingerprint: digest(before),
    changed: digest(before) !== digest(after),
  };
}

async function preflight(db, options = {}) {
  const known = await db.collection("bases").find().sort({ _id: 1 }).toArray();
  const bases = copy(known),
    prefixes = new Set(),
    baseIds = new Set();
  for (const b of bases) {
    if (
      !/^[a-f0-9-]{36}$/.test(b.id || "") ||
      prefixes.has(b.prefix) ||
      baseIds.has(b.id) ||
      !(b.prefix === "" || /^base_[a-f0-9]{32}_$/.test(b.prefix || ""))
    )
      throw new Error(
        "Malformed/duplicate base namespace; no writes performed",
      );
    prefixes.add(b.prefix);
    baseIds.add(b.id);
  }
  if (bases.length && !prefixes.has(""))
    throw new Error("Original base namespace missing; no writes performed");
  if (!bases.length)
    bases.push({
      _id: "original",
      id: randomUUID(),
      prefix: "",
      createdAt: new Date().toISOString(),
      version: 1,
    });
  const original = bases.find((b) => b.prefix === "");
  const names = [
    "users",
    "bases",
    ...new Set(
      bases.flatMap((b) => [b.prefix + "rooms", b.prefix + "settings"]),
    ),
  ];
  const before = {};
  for (const name of names)
    before[name] = await db.collection(name).find().sort({ _id: 1 }).toArray();
  const after = copy(before);
  after.bases = bases;
  for (const base of bases) {
    const mapped = {
      collection(name) {
        return db.collection(name === "users" ? name : base.prefix + name);
      },
    };
    const plan = await preflightSingle(mapped, options);
    after[base.prefix + "rooms"] = plan.after.rooms;
    after[base.prefix + "settings"] = plan.after.settings;
    after[base.prefix + "settings"][0].iisnodeMultibaseSchema = 1;
    if (base.prefix === "") after.users = plan.after.users;
  }
  const validBases = new Set(bases.map((b) => b.id));
  for (const u of after.users) {
    u.username = sam(u.username);
    u.role = u.owner ? "owner" : u.role;
    u.baseIds ||= [original.id];
    u.version ||= 1;
    if (
      !Array.isArray(u.baseIds) ||
      new Set(u.baseIds).size !== u.baseIds.length ||
      u.baseIds.some((id) => !validBases.has(id))
    )
      throw new Error("Malformed base membership; no writes performed");
    if (
      u.baseGrants !== undefined &&
      (!u.baseGrants ||
        typeof u.baseGrants !== "object" ||
        Array.isArray(u.baseGrants))
    )
      throw new Error("Malformed base grants; no writes performed");
    for (const [baseId, g] of Object.entries(u.baseGrants || {})) {
      const base = bases.find((b) => b.id === baseId);
      const rooms = base ? after[base.prefix + "rooms"] : [];
      const ids = new Set(rooms.map((r) => r.id));
      if (
        !base ||
        !u.baseIds.includes(baseId) ||
        !["admin", "technician", "commander", "viewer"].includes(g?.role) ||
        !Array.isArray(g.roomIds) ||
        g.roomIds.some((id) => !ids.has(id)) ||
        typeof g.active !== "boolean" ||
        typeof g.allRooms !== "boolean"
      )
        throw new Error("Malformed per-base grant; no writes performed");
    }
  }
  return {
    before,
    after,
    collections: names,
    bootstrap: options,
    fingerprint: digest(before),
    changed: digest(before) !== digest(after),
  };
}

async function ensureIndexes(db) {
  await db.collection("users").createIndex({ username: 1 }, { unique: true });
  await db.collection("bases").createIndex({ id: 1 }, { unique: true });
  await db.collection("bases").createIndex({ prefix: 1 }, { unique: true });
  for (const name of ["sessions", "launchTokens"])
    await db
      .collection(name)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db
    .collection("commandSnapshots")
    .createIndex({ baseId: 1, bucket: 1 }, { unique: true });
  await db.collection("commandSnapshots").createIndex({ baseId: 1, at: -1 });
  for (const base of await db.collection("bases").find().toArray())
    await require("./command-overview.js").ensureBaseIndexes(db, base);
}
async function applyMigration(
  db,
  plan,
  {
    resumeId,
    bootstrap = {},
    onPreparation = () => {},
    onCheckpoint = () => {},
  } = {},
) {
  const journal = db.collection("migrationRuns"),
    records = db.collection("migrationRecords");
  let run,
    collections = plan?.collections || [];
  if (resumeId) {
    run = await journal.findOne({ _id: resumeId });
    const active = await journal.findOne({ _id: "active" });
    collections = run?.collections || active?.collections || [];
    if (active && active.runId !== resumeId)
      throw new Error("Another migration is active");
    // A process may stop before the backup is complete. No business write is
    // permitted until status=applying; incomplete backups must never be restored.
    if (!run && active?.runId === resumeId) {
      await records.deleteMany({ runId: resumeId });
      await journal.deleteOne({ _id: "active", runId: resumeId });
      return applyMigration(
        db,
        await preflight(db, active.bootstrap || bootstrap),
      );
    }
    if (run?.status === "preparing") {
      const live = {};
      for (const n of collections)
        live[n] = await db.collection(n).find().sort({ _id: 1 }).toArray();
      if (digest(live) !== run.fingerprint)
        throw new Error(
          "Database changed during backup preparation; manual recovery required",
        );
      await records.deleteMany({ runId: resumeId });
      await journal.deleteOne({ _id: resumeId });
      await journal.deleteOne({ _id: "active", runId: resumeId });
      return applyMigration(db, await preflight(db, run.bootstrap));
    }
    if (!run || !["applying", "verified"].includes(run.status))
      throw new Error("Unknown migration to resume");
    if (run.status === "verified") return run._id;
  } else {
    const existing = await journal.findOne({ _id: "active" });
    if (existing)
      throw new Error("Migration already in progress; resume or restore it");
    if (!plan) throw new Error("Preflight plan required");
    const live = {};
    for (const n of collections)
      live[n] = await db.collection(n).find().sort({ _id: 1 }).toArray();
    if (digest(live) !== plan.fingerprint)
      throw new Error("Database changed after preflight; no writes performed");
    if (!plan.changed) {
      await ensureIndexes(db);
      return null;
    }
    const id = randomUUID();
    await journal.insertOne({
      _id: "active",
      runId: id,
      collections,
      bootstrap: plan.bootstrap,
    });
    run = {
      _id: id,
      status: "preparing",
      collections,
      startedAt: new Date(),
      checkpoint: 0,
      fingerprint: plan.fingerprint,
      expected: digest(plan.after),
      bootstrap: {
        ownerSam: plan.after.users.find((u) => u.role === "owner")?.username,
        adminSam: plan.before.users.length
          ? undefined
          : plan.after.users.find((u) => u.role === "admin")?.username,
      },
    };
    await journal.insertOne(run);
    {
      const rows = [];
      for (const n of collections) {
        for (const doc of plan.before[n])
          rows.push({
            _id: randomUUID(),
            runId: id,
            collection: n,
            phase: "before",
            doc,
          });
        for (const doc of plan.after[n])
          rows.push({
            _id: randomUUID(),
            runId: id,
            collection: n,
            phase: "after",
            doc,
          });
      }
      if (rows.length) await records.insertMany(rows);
      await onPreparation(id);
      await journal.updateOne({ _id: id }, { $set: { status: "applying" } });
      run.status = "applying";
    }
  }
  // Application must be stopped during apply/restore; startup refuses active journal.
  for (const n of collections) {
    const docs = await records
      .find({ runId: run._id, collection: n, phase: "after" })
      .toArray();
    for (const { doc } of docs) {
      await db
        .collection(n)
        .replaceOne({ _id: doc._id }, doc, { upsert: true });
      await journal.updateOne({ _id: run._id }, { $inc: { checkpoint: 1 } });
      await onCheckpoint(n, doc);
    }
  }
  await ensureIndexes(db);
  const actual = {};
  for (const n of collections)
    actual[n] = await db.collection(n).find().sort({ _id: 1 }).toArray();
  // Document order is not business data; compare each planned record directly.
  for (const n of collections) {
    const expected = await records
      .find({ runId: run._id, collection: n, phase: "after" })
      .toArray();
    if (
      actual[n].length !== expected.length ||
      expected.some(
        ({ doc }) => !actual[n].some((x) => digest(x) === digest(doc)),
      )
    )
      throw new Error(
        "Migration verification failed; restore or resume using recorded runId",
      );
  }
  await journal.updateOne(
    { _id: run._id },
    { $set: { status: "verified", verifiedAt: new Date() } },
  );
  await journal.deleteOne({ _id: "active", runId: run._id });
  return run._id;
}
async function restoreMigration(db, runId) {
  const journal = db.collection("migrationRuns");
  const run = await journal.findOne({ _id: runId });
  const collections = run?.collections || [];
  if (!run) throw new Error("Unknown migration backup");
  if (run.status === "preparing")
    throw new Error(
      "Incomplete backup: use resume; application records were not modified",
    );
  const active = await journal.findOne({ _id: "active" });
  if (active && active.runId !== runId)
    throw new Error("Another migration is active");
  await journal.updateOne(
    { _id: "active" },
    { $set: { runId } },
    { upsert: true },
  );
  await journal.updateOne({ _id: runId }, { $set: { status: "restoring" } });
  for (const n of collections) {
    const docs = await db
      .collection("migrationRecords")
      .find({ runId, collection: n, phase: "before" })
      .toArray();
    if (n === "users") {
      try {
        await db.collection(n).dropIndex("username_1");
      } catch (e) {
        if (![26, 27].includes(e.code)) throw e;
      }
    }
    await db.collection(n).deleteMany({});
    if (docs.length) await db.collection(n).insertMany(docs.map((r) => r.doc));
  }
  await journal.updateOne(
    { _id: runId },
    { $set: { status: "restored", restoredAt: new Date() } },
  );
  await journal.deleteOne({ _id: "active", runId });
}
async function initializeForTest(db, config) {
  if (!/^readiness_test_/.test(db.databaseName) || config.nodeEnv !== "test")
    throw new Error("Explicit isolated test database required");
  if (
    config.authMode === "local-test" &&
    !(await db.collection("users").countDocuments()) &&
    !(await db.collection("rooms").countDocuments())
  ) {
    await db.collection("rooms").insertMany(require("./seed.js").sampleRooms());
    await db.collection("settings").insertOne({
      _id: "main",
      baseName: "בסיס לדוגמה",
      freshnessDays: 7,
      note: "",
      demo: true,
      remindersEnabled: false,
      recipients: [],
      schemaVersion: 1,
    });
  }
  await applyMigration(
    db,
    await preflight(db, {
      ownerSam: config.values.BOOTSTRAP_OWNER_SAM || "admin",
      adminSam: config.values.BOOTSTRAP_ADMIN_SAM,
    }),
  );
  if (
    config.authMode !== "local-test" ||
    (await db.collection("users").countDocuments({ testAccount: true }))
  )
    return;
  const rooms = await db.collection("rooms").find().toArray(),
    hamal = rooms.find((r) => r.type === "חמ״ל") || rooms[0];
  const base = await db.collection("bases").findOne({ prefix: "" });
  const names = {
    admin: "מנהל מערכת לדוגמה",
    command_admin: "מנהל מערכת פיקודי לדוגמה",
    technician: "טכנאי לדוגמה",
    commander: "מפקד מרחב לדוגמה",
    viewer: "נציג מרחב לדוגמה",
  };
  await db.collection("users").insertMany(
    Object.entries(names).map(([role, name]) => {
      const id = randomUUID();
      return {
        _id: id,
        id,
        username: "test." + role,
        name,
        role,
        roomIds:
          role === "technician"
            ? rooms.map((r) => r.id)
            : hamal
              ? [hamal.id]
              : [],
        baseIds: [base.id],
        version: 1,
        active: true,
        testAccount: true,
        email: "",
        preferences: { theme: "light" },
      };
    }),
  );
}
exports.preflight = preflight;
exports.applyMigration = applyMigration;
exports.restoreMigration = restoreMigration;
exports.ensureIndexes = ensureIndexes;
exports.initializeForTest = initializeForTest;
