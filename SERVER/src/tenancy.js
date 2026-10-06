"use strict";
const { AsyncLocalStorage } = require("node:async_hooks");
const { randomUUID } = require("node:crypto");
const { z } = require("zod");
const { fail, parse, id, short } = require("./validation.js");
const { safeUser } = require("./security.js");
const { aggregate, ROLES } = require("../shared/model.js");

const {
  globalAccess,
  canAccessBase,
  managesBase,
  managesAnyBase,
  userInBase,
  userPipeline,
} = require("./base-access.js");
const { installAccessRoutes } = require("./access-routes.js");
const { installCommandOverview } = require("./command-overview.js");
exports.globalAccess = require("./base-access.js").globalAccess;
exports.canAccessBase = require("./base-access.js").canAccessBase;
const storage = new AsyncLocalStorage();
const localCollections = new Set([
  "rooms",
  "settings",
  "media",
  "adminAudit",
  "mailOutbox",
]);
const membership = (baseId) => ({
  $or: [{ role: { $in: ["owner", "command_admin"] } }, { baseIds: baseId }],
});

// Resolve the namespace on every operation, inside this request's async context.
// Never fall back to a default base when context is absent.
function tenantDatabase(raw) {
  function current() {
    const base = storage.getStore();
    if (!base) throw new Error("Base context is required");
    return base;
  }
  const collection = (name) =>
    new Proxy(
      {},
      {
        get(_, method) {
          return (...args) => {
            const base = current();
            if (name === "sessions")
              return raw.collection(name)[method](...args);
            if (name === "users") {
              if (!["find", "findOne", "countDocuments"].includes(method))
                throw new Error(
                  "Identity writes require the central access service",
                );
              const pipeline = userPipeline(base.id, args[0] || {});
              if (method === "countDocuments")
                return raw
                  .collection("users")
                  .aggregate([...pipeline, { $count: "count" }])
                  .next()
                  .then((v) => v?.count || 0);
              if (args[1]?.projection)
                pipeline.push({ $project: args[1].projection });
              const cursor = raw.collection("users").aggregate(pipeline);
              return method === "findOne" ? cursor.next() : cursor;
            }
            if (!localCollections.has(name))
              throw new Error("Unknown tenant collection");
            return raw.collection(base.prefix + name)[method](...args);
          };
        },
      },
    );
  return { collection, admin: () => raw.admin() };
}
const runInBase = (base, action) => storage.run(base, action);

async function initializeBases(raw) {
  const bases = raw.collection("bases");
  await bases.createIndex({ id: 1 }, { unique: true });
  await bases.createIndex({ prefix: 1 }, { unique: true });
  const firstId = randomUUID();
  // The original collections become the first base, without copying or deleting records.
  await bases.updateOne(
    { _id: "original" },
    {
      $setOnInsert: {
        id: firstId,
        prefix: "",
        createdAt: new Date().toISOString(),
        version: 1,
      },
    },
    { upsert: true },
  );
  const first = await bases.findOne({ _id: "original" });
  await raw
    .collection("users")
    .updateMany(
      { baseIds: { $exists: false } },
      { $set: { baseIds: [first.id], version: 1 } },
    );
  return first;
}

async function installTenancy(app, raw) {
  await installCommandOverview(app, raw);
  const bases = raw.collection("bases"),
    users = raw.collection("users");
  async function catalog(user) {
    const rows = await bases
      .find({
        deletedAt: { $exists: false },
        ...(globalAccess(user)
          ? {}
          : {
              id: {
                $in: (user.baseIds || []).filter((id) =>
                  canAccessBase(user, id),
                ),
              },
            }),
      })
      .toArray();
    return Promise.all(
      rows.map(async (base) => ({
        id: base.id,
        version: base.version,
        name:
          (
            await raw
              .collection(base.prefix + "settings")
              .findOne({ _id: "main" })
          )?.baseName || "בסיס",
      })),
    );
  }
  app.get("/api/bases", async (req, res) => res.json(await catalog(req.user)));
  app.get("/api/bases/archived", async (req, res) => {
    if (!globalAccess(req.user)) throw fail(403, "אין הרשאה לניהול בסיסים");
    const data = [];
    for (const base of await bases
      .find({ deletedAt: { $exists: true } })
      .toArray())
      data.push({
        id: base.id,
        version: base.version,
        deletedAt: base.deletedAt,
        name:
          (
            await raw
              .collection(base.prefix + "settings")
              .findOne({ _id: "main" })
          )?.baseName || "בסיס",
      });
    res.json(data);
  });
  app.delete("/api/bases/:id", async (req, res) => {
    if (!globalAccess(req.user))
      throw fail(403, "מחיקת בסיס מותרת לבעלים ולמנהל פיקודי בלבד");
    const input = parse(
      z
        .object({ version: z.number().int(), confirmation: z.string() })
        .strict(),
      req.body,
    );
    const base = await bases.findOne({
      id: req.params.id,
      deletedAt: { $exists: false },
    });
    if (!base) throw fail(404, "הבסיס לא נמצא");
    const settings = await raw
      .collection(base.prefix + "settings")
      .findOne({ _id: "main" });
    if (input.confirmation !== settings.baseName)
      throw fail(400, "יש להקליד את שם הבסיס לאישור מחיקתו");
    if (
      !(
        await bases.updateOne(
          {
            id: base.id,
            version: input.version,
            deletedAt: { $exists: false },
          },
          {
            $set: {
              deletedAt: new Date().toISOString(),
              deletedBy: req.user.id,
            },
            $inc: { version: 1 },
          },
        )
      ).matchedCount
    )
      throw fail(409, "רשומת הבסיס עודכנה. יש לרענן");
    await raw.collection("globalAudit").insertOne({
      id: randomUUID(),
      at: new Date().toISOString(),
      actor: req.user.name,
      action: "מחיקת בסיס",
      detail: settings.baseName,
      baseId: base.id,
    });
    res.json({ ok: true });
  });
  app.post("/api/bases/:id/restore", async (req, res) => {
    if (!globalAccess(req.user))
      throw fail(403, "שחזור בסיס מותר לבעלים ולמנהל פיקודי בלבד");
    const { version } = parse(
      z.object({ version: z.number().int() }),
      req.body,
    );
    if (
      !(
        await bases.updateOne(
          { id: req.params.id, version, deletedAt: { $exists: true } },
          { $unset: { deletedAt: "", deletedBy: "" }, $inc: { version: 1 } },
        )
      ).matchedCount
    )
      throw fail(409, "הבסיס עודכן או שאינו מחוק");
    await raw.collection("globalAudit").insertOne({
      id: randomUUID(),
      at: new Date().toISOString(),
      actor: req.user.name,
      action: "שחזור בסיס",
      detail: req.params.id,
    });
    res.json({ ok: true });
  });
  app.post("/api/bases", async (req, res) => {
    if (!globalAccess(req.user))
      throw fail(403, "הוספת בסיס מותרת לבעלים ולמנהל מערכת פיקודי בלבד");
    const { name } = parse(z.object({ name: short }).strict(), req.body);
    const baseId = randomUUID(),
      prefix = "base_" + baseId.replaceAll("-", "") + "_";
    const template = await raw.collection("settings").findOne({ _id: "main" });
    const settings = {
      ...template,
      _id: "main",
      version: 1,
      baseName: name,
      note: "",
      round: null,
      demo: false,
      remindersEnabled: false,
      requestMailEnabled: false,
      recipients: [],
      baseMap: { imageId: null, markers: [] },
      schedule: { enabled: false, day: 4, time: "17:00" },
    };
    await raw.collection(prefix + "settings").insertOne(settings);
    await raw
      .collection(prefix + "rooms")
      .createIndex({ id: 1 }, { unique: true });
    await raw.collection(prefix + "mailOutbox").createIndex({ status: 1 });
    const base = {
      _id: baseId,
      id: baseId,
      prefix,
      createdAt: new Date().toISOString(),
      version: 1,
    };
    // Publish only after all base resources are ready.
    await require("./command-overview.js").ensureBaseIndexes(raw, base);
    await bases.insertOne(base);
    await raw.collection("globalAudit").insertOne({
      at: new Date().toISOString(),
      actor: req.user.id,
      action: "create_base",
      baseId,
      name,
    });
    res.status(201).json({ id: baseId, name });
  });

  app.get("/api/base-overview", async (req, res) => {
    if (!managesAnyBase(req.user)) throw fail(403, "נדרשת הרשאת ניהול");
    const rows = [];
    for (const base of (await catalog(req.user)).filter((base) =>
      managesBase(req.user, base.id),
    )) {
      const entry = await bases.findOne({ id: base.id });
      const settings = await raw
        .collection(entry.prefix + "settings")
        .findOne({ _id: "main" });
      const rooms = await raw
        .collection(entry.prefix + "rooms")
        .find()
        .toArray();
      rows.push({
        ...base,
        metrics: aggregate(rooms, true, settings),
        roomCount: rooms.length,
        faultCount: rooms.reduce(
          (n, r) => n + r.faults.filter((f) => f.status !== "closed").length,
          0,
        ),
      });
    }
    res.json(rows);
  });
  app.get("/api/access-catalog", async (req, res) => {
    if (!managesAnyBase(req.user)) throw fail(403, "נדרשת הרשאת ניהול");
    const visible = (await catalog(req.user)).filter(
      (base) =>
        globalAccess(req.user) ||
        (base.id === req.get("X-Base-Id") && managesBase(req.user, base.id)),
    );
    const rooms = [];
    for (const base of visible) {
      const entry = await bases.findOne({ id: base.id });
      rooms.push(
        ...(
          await raw
            .collection(entry.prefix + "rooms")
            .find({}, { projection: { _id: 0, id: 1, name: 1, type: 1 } })
            .toArray()
        ).map((r) => ({ ...r, baseId: base.id, baseName: base.name })),
      );
    }
    res.json({ bases: visible, rooms });
  });
  installAccessRoutes(app, raw);
  app.patch("/api/preferences", async (req, res) => {
    const input = parse(
      z.object({ theme: z.enum(["light", "dark"]) }),
      req.body,
    );
    await users.updateOne(
      { id: req.user.id },
      { $set: { "preferences.theme": input.theme } },
    );
    res.json({ ok: true });
  });
  app.get("/api/global-audit", async (req, res) => {
    if (!globalAccess(req.user)) throw fail(403, "יומן פיקודי אינו מורשה");
    res.json(
      await raw
        .collection("globalAudit")
        .find({}, { projection: { _id: 0 } })
        .sort({ at: -1 })
        .limit(500)
        .toArray(),
    );
  });
  app.use("/api", async (req, res, next) => {
    const requested = req.get("X-Base-Id");
    const visible = await catalog(req.user);
    if (requested && !/^[a-f0-9-]{36}$/.test(requested))
      throw fail(400, "מזהה בסיס לא תקין");
    const baseId = requested || visible[0]?.id;
    if (!baseId && globalAccess(req.user) && req.path === "/state") {
      req.noBase = true;
      return next();
    }
    if (!baseId || !canAccessBase(req.user, baseId))
      throw fail(403, "אין הרשאה לבסיס המבוקש");
    const base = await bases.findOne({
      id: baseId,
      deletedAt: { $exists: false },
    });
    if (!base) throw fail(404, "הבסיס אינו קיים");
    req.base = { id: baseId, name: visible.find((b) => b.id === baseId).name };
    req.bases = visible;
    const ids = (
      await raw
        .collection(base.prefix + "rooms")
        .find({}, { projection: { id: 1 } })
        .toArray()
    ).map((r) => r.id);
    req.user = {
      ...userInBase(req.user, base.id),
      roomIds: (userInBase(req.user, base.id).roomIds || []).filter((id) =>
        ids.includes(id),
      ),
    };
    storage.run(base, next);
  });
}

exports.tenantDatabase = tenantDatabase;
exports.runInBase = runInBase;
exports.initializeBases = initializeBases;
exports.installTenancy = installTenancy;
