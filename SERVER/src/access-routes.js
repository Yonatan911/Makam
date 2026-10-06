"use strict";
const { randomUUID } = require("node:crypto");
const { z } = require("zod");
const { parse, fail, id } = require("./validation.js");
const { ROLES } = require("../shared/model.js");
const { safeUser } = require("./security.js");
const { globalAccess, grantFor, managesBase } = require("./base-access.js");

const localRoles = ["admin", "technician", "commander", "viewer"];
const grantSchema = z
  .object({
    baseId: id,
    role: z.enum(localRoles),
    roomIds: z.array(id).max(2000),
    allRooms: z.boolean(),
    active: z.boolean(),
  })
  .strict();
const schema = z
  .object({
    username: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/),
    name: z.string().trim().max(100).default(""),
    email: z.union([z.email(), z.literal("")]).default(""),
    role: z.enum(Object.keys(ROLES)),
    baseIds: z.array(id).max(500),
    roomIds: z.array(id).max(2000),
    allRooms: z.boolean().default(false),
    active: z.boolean(),
    version: z.number().int().min(0).optional(),
    grants: z.array(grantSchema).max(500).optional(),
  })
  .strict();

function installAccessRoutes(app, raw) {
  const users = raw.collection("users"),
    bases = raw.collection("bases");
  async function selected(req) {
    const id =
      req.get("X-Base-Id") ||
      req.user.baseIds?.find((id) => managesBase(req.user, id));
    const base = await bases.findOne({ id, deletedAt: { $exists: false } });
    if (!base || !managesBase(req.user, base.id))
      throw fail(403, "אין הרשאת ניהול לבסיס הנבחר");
    return base;
  }
  const manager = async (req, res, next) => {
    req.accessBase = globalAccess(req.user) ? null : await selected(req);
    next();
  };
  const canEditGlobal = (actor, target) =>
    target.role === "owner"
      ? actor.role === "owner" && actor.id === target.id
      : target.role === "command_admin"
        ? actor.role === "owner"
        : globalAccess(actor);
  const localView = (target, base) => {
    const grant = grantFor(target, base.id);
    if (!grant || (globalAccess(target) && !target.baseGrants?.[base.id]))
      return null;
    return {
      id: target.id,
      username: target.username,
      name: grant.name || target.name,
      email: grant.email ?? target.email ?? "",
      role: grant.role,
      roomIds: grant.roomIds || [],
      allRooms: grant.allRooms === true,
      active: grant.active,
      version: grant.version || 0,
      baseIds: [base.id],
      canManage: grant.role !== "admin",
      localOnly: true,
    };
  };
  app.get("/api/users", manager, async (req, res) => {
    if (req.accessBase) {
      const list = await users.find({ baseIds: req.accessBase.id }).toArray();
      const roomIds = new Set(
        (
          await raw
            .collection(req.accessBase.prefix + "rooms")
            .find({}, { projection: { id: 1 } })
            .toArray()
        ).map((r) => r.id),
      );
      return res.json(
        list
          .map((u) => localView(u, req.accessBase))
          .filter(Boolean)
          .map((u) => ({
            ...u,
            roomIds: u.roomIds.filter((id) => roomIds.has(id)),
          })),
      );
    }
    const allBases = await bases.find().toArray();
    const roomIdsByBase = new Map();
    for (const base of allBases)
      roomIdsByBase.set(
        base.id,
        new Set(
          (
            await raw
              .collection(base.prefix + "rooms")
              .find({}, { projection: { id: 1 } })
              .toArray()
          ).map((r) => r.id),
        ),
      );
    res.json(
      (await users.find().toArray()).map((u) => ({
        ...safeUser(u),
        canManage: canEditGlobal(req.user, u),
        grants: allBases
          .filter(
            (b) =>
              grantFor(u, b.id) && (!globalAccess(u) || u.baseGrants?.[b.id]),
          )
          .map((b) => ({
            baseId: b.id,
            ...grantFor(u, b.id),
            roomIds: (grantFor(u, b.id).roomIds || []).filter((id) =>
              roomIdsByBase.get(b.id).has(id),
            ),
            archived: !!b.deletedAt,
          })),
      })),
    );
  });
  async function validateGrant(grant) {
    const base = await bases.findOne({
      id: grant.baseId,
      deletedAt: { $exists: false },
    });
    if (!base) throw fail(400, "בסיס לא קיים או הוסר");
    if (
      new Set(grant.roomIds).size !== grant.roomIds.length ||
      (await raw
        .collection(base.prefix + "rooms")
        .countDocuments({ id: { $in: grant.roomIds } })) !==
        grant.roomIds.length
    )
      throw fail(400, "כל מרחב חייב להשתייך לבסיס שנבחר");
    if (
      grant.active &&
      ["viewer", "commander"].includes(grant.role) &&
      !grant.allRooms &&
      !grant.roomIds.length
    )
      throw fail(400, "יש לבחור מרחב אחד לפחות או את כלל המרחבים בבסיס");
    return base;
  }
  async function audit(actor, target, baseIds, action) {
    const globalEntry = {
      id: randomUUID(),
      at: new Date().toISOString(),
      actorId: actor.id,
      actor: actor.name,
      action,
      detail: target.username,
      details: { baseIds },
    };
    await raw.collection("globalAudit").insertOne(globalEntry);
    for (const base of await bases
      .find({ id: { $in: baseIds }, deletedAt: { $exists: false } })
      .toArray()) {
      const { _id, details, ...local } = globalEntry;
      await raw.collection(base.prefix + "adminAudit").insertOne(local);
    }
  }
  async function localWrite(req, input, target, creating) {
    const base = req.accessBase;
    if (
      input.grants ||
      input.baseIds.length !== 1 ||
      input.baseIds[0] !== base.id ||
      !["technician", "commander", "viewer"].includes(input.role)
    )
      throw fail(403, "אפשר להקצות הרשאה מקומית רגילה בבסיס הנבחר בלבד");
    const grant = {
      role: input.role,
      roomIds: input.roomIds,
      allRooms: input.allRooms,
      active: input.active,
    };
    await validateGrant({ ...grant, baseId: base.id });
    if (
      !creating &&
      (!target || input.username.toLowerCase() !== target.username)
    )
      throw fail(404, "הרשאה מקומית לא נמצאה");
    if (creating) {
      const uid = randomUUID(),
        username = input.username.toLowerCase();
      // Same operation and response whether or not an identity exists elsewhere.
      try {
        await users.updateOne(
          { username },
          {
            $setOnInsert: {
              _id: uid,
              id: uid,
              username,
              name: input.name || username,
              email: input.email,
              role: "viewer",
              active: true,
              baseIds: [],
              roomIds: [],
              preferences: {},
              version: 1,
            },
          },
          { upsert: true },
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
      target = await users.findOne({ username });
    }
    const previous = grantFor(target, base.id);
    if (previous?.role === "admin")
      throw fail(
        403,
        "מינוי ושינוי מנהל בסיס מותרים לניהול הפיקודי ולבעלים בלבד",
      );
    if (creating && previous)
      throw fail(409, "למשתמש כבר קיימת הרשאה בבסיס זה. יש לערוך אותה ברשימה");
    if (!creating && !previous) throw fail(404, "הרשאה מקומית לא נמצאה");
    if (!creating && input.version !== (previous.version || 0))
      throw fail(409, "ההרשאה המקומית עודכנה. יש לרענן");
    const key = "baseGrants." + base.id;
    const filter = target.baseGrants?.[base.id]
      ? { [key + ".version"]: previous.version }
      : {
          [key]: { $exists: false },
          version: target.version,
          ...(creating ? { baseIds: { $ne: base.id } } : {}),
        };
    const value = {
      ...grant,
      name: input.name || target.username,
      email: input.email,
      version: (previous?.version || 0) + 1,
    };
    if (
      !(
        await users.updateOne(
          { id: target.id, ...filter },
          {
            $set: { [key]: value },
            $addToSet: { baseIds: base.id },
            $inc: { version: 1 },
          },
        )
      ).matchedCount
    )
      throw fail(409, "ההרשאה המקומית עודכנה. יש לרענן");
    await audit(
      req.user,
      target,
      [base.id],
      creating ? "הוספת הרשאה לבסיס" : "עדכון הרשאה בבסיס",
    );
    return { id: target.id };
  }
  async function globalWrite(req, input, target) {
    if (target && !canEditGlobal(req.user, target))
      throw fail(403, "חשבון הניהול מוגן");
    if (
      input.role === "owner" &&
      !(target?.role === "owner" && req.user.id === target.id)
    )
      throw fail(403, "לא ניתן למנות בעלים נוסף");
    if (
      target?.role === "owner" &&
      (input.role !== "owner" ||
        !input.active ||
        input.username.toLowerCase() !== target.username)
    )
      throw fail(403, "חשבון הבעלים מוגן");
    if (input.role === "command_admin" && req.user.role !== "owner")
      throw fail(403, "רק הבעלים רשאי למנות מנהל פיקודי");
    if (target && input.version !== target.version)
      throw fail(409, "ההרשאות עודכנו בינתיים. יש לרענן");
    if (new Set(input.baseIds).size !== input.baseIds.length)
      throw fail(400, "אין לשייך בסיס פעמיים");
    let grants = input.grants;
    if (!grants) {
      const known = await bases
        .find({ id: { $in: input.baseIds }, deletedAt: { $exists: false } })
        .toArray();
      if (known.length !== input.baseIds.length)
        throw fail(400, "בסיס לא קיים או הוסר");
      const assigned = new Set();
      grants = [];
      for (const base of known) {
        const rooms = await raw
          .collection(base.prefix + "rooms")
          .find({ id: { $in: input.roomIds } })
          .toArray();
        rooms.forEach((r) => assigned.add(r.id));
        grants.push({
          baseId: base.id,
          role: localRoles.includes(input.role) ? input.role : "viewer",
          roomIds: rooms.map((r) => r.id),
          allRooms: input.allRooms,
          active: input.active,
        });
      }
      if (assigned.size !== input.roomIds.length)
        throw fail(400, "שיוך מרחבים אינו תקין");
    }
    if (new Set(grants.map((g) => g.baseId)).size !== grants.length)
      throw fail(400, "אין לשייך בסיס פעמיים");
    if (!globalAccess(input) && !grants.length && input.active)
      throw fail(400, "יש לבחור בסיס אחד לפחות");
    for (const grant of grants)
      if (!globalAccess(input)) await validateGrant(grant);
    const baseGrants = {};
    // Retain archived-base grants for restoration, unless the entire identity is disabled.
    for (const base of await bases
      .find({ deletedAt: { $exists: true } })
      .toArray()) {
      const old = target && grantFor(target, base.id);
      if (old) baseGrants[base.id] = old;
    }
    for (const grant of grants) {
      const { baseId, ...value } = grant;
      baseGrants[baseId] = {
        ...value,
        version: (target ? grantFor(target, baseId)?.version || 0 : 0) + 1,
      };
    }
    const uid = target?.id || randomUUID();
    const value = {
      username: input.username.toLowerCase(),
      name: input.name || input.username,
      email: input.email,
      role: input.role,
      active: input.active,
      baseIds: Object.keys(baseGrants),
      baseGrants,
      roomIds: input.roomIds,
      allRooms: input.allRooms,
      version: (target?.version || 0) + 1,
    };
    if (!input.grants && !Object.keys(target?.baseGrants || {}).length) {
      value.baseGrants = {};
      value.baseIds = input.baseIds;
    }
    if (target) {
      if (
        !(
          await users.updateOne(
            { id: uid, version: target.version },
            { $set: value },
          )
        ).matchedCount
      )
        throw fail(409, "בוצע עדכון מקביל להרשאות");
      if (
        !value.active ||
        value.role !== target.role ||
        value.username !== target.username
      )
        await raw.collection("sessions").deleteMany({ userId: uid });
    } else
      await users.insertOne({ _id: uid, id: uid, ...value, preferences: {} });
    await audit(
      req.user,
      value,
      [...new Set([...(target?.baseIds || []), ...value.baseIds])],
      target ? "עדכון הרשאות פיקודי" : "הקצאת הרשאה ידנית",
    );
    return { id: uid };
  }
  app.post("/api/users", manager, async (req, res) => {
    const input = parse(schema, req.body);
    res
      .status(201)
      .json(
        req.accessBase
          ? await localWrite(req, input, null, true)
          : await globalWrite(req, input, null),
      );
  });
  app.patch("/api/users/:id", manager, async (req, res) => {
    const input = parse(schema, req.body),
      target = await users.findOne({ id: req.params.id });
    if (!target) throw fail(404, "משתמש לא נמצא");
    const result = req.accessBase
      ? await localWrite(req, input, target, false)
      : await globalWrite(req, input, target);
    res.json({ ok: true, ...result });
  });
  app.delete("/api/users/:id", manager, async (req, res) => {
    const target = await users.findOne({ id: req.params.id });
    if (req.accessBase) {
      const local = target && localView(target, req.accessBase);
      if (!local) throw fail(404, "הרשאה מקומית לא נמצאה");
      const allowedRooms = await raw
        .collection(req.accessBase.prefix + "rooms")
        .find({ id: { $in: local.roomIds } }, { projection: { id: 1 } })
        .toArray();
      local.roomIds = allowedRooms.map((r) => r.id);
      const { version } = parse(
        z.object({ version: z.number().int() }),
        req.body,
      );
      await localWrite(
        req,
        { ...local, active: false, version },
        target,
        false,
      );
    } else {
      if (
        !target ||
        !canEditGlobal(req.user, target) ||
        target.role === "owner" ||
        target.id === req.user.id
      )
        throw fail(403, "אין הרשאה להסרת החשבון");
      const { version } = parse(
        z.object({ version: z.number().int() }),
        req.body,
      );
      if (
        !(
          await users.updateOne(
            { id: target.id, version },
            { $set: { active: false }, $inc: { version: 1 } },
          )
        ).matchedCount
      )
        throw fail(409, "ההרשאות עודכנו. יש לרענן");
      await raw.collection("sessions").deleteMany({ userId: target.id });
      await audit(
        req.user,
        target,
        target.baseIds || [],
        "השבתת חשבון פיקודית",
      );
    }
    res.json({ ok: true });
  });
}

exports.installAccessRoutes = installAccessRoutes;
