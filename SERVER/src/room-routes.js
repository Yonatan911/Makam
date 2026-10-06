"use strict";
const { randomUUID } = require("node:crypto");
const { z } = require("zod");
const {
  ACTIVE,
  TRANSITIONS,
  STATUSES,
  ROOM_TYPES,
  activeAssets,
  isManager,
  readiness,
  dependencyIds,
} = require("../shared/model.js");
const { canWrite } = require("./security.js");
const {
  parse,
  fail,
  id,
  short,
  note,
  timestamp,
  assetSchema,
  cleanAsset,
  validateDependencies,
  applyDependents,
  planSchema,
  validatePlan,
  scheduleSchema,
} = require("./validation.js");
function installRoomRoutes(ctx) {
  const {
    app,
    db,
    rooms,
    users,
    manager,
    roomFor,
    saveRoom,
    getSettings,
    audit,
  } = ctx;
  const emit = (room, type, request, user, detail) => {
    room.mailEvents ||= [];
    room.mailEvents.push({
      id: randomUUID(),
      type,
      requestId: request?.id,
      at: new Date().toISOString(),
      actor: user.name,
      requesterId: request?.requestedById,
      detail,
    });
  };
  const faultFor = (room, assetId) =>
    room.faults.find((f) => f.assetId === assetId && f.status !== "closed");
  async function assignee(id, roomId) {
    if (!id) return;
    const person = await users.findOne({ id, active: true });
    if (!person || !canWrite(person, roomId))
      throw fail(400, "הטכנאי שנבחר אינו מורשה לטפל במרחב");
  }
  function closeFault(room, fault, asset, user, comment, mode) {
    const at = new Date().toISOString();
    Object.assign(fault, {
      status: "closed",
      closedAt: at,
      closedBy: user.name,
      closedById: user.id,
      closureNote: comment,
      closureMode: mode,
    });
    fault.history.push({
      at,
      actor: user.name,
      actorId: user.id,
      status: "closed",
      note: comment,
      mode,
    });
    Object.assign(asset, { status: "closed", note: comment });
    room.audit.push(
      audit(
        user,
        "סגירת פער",
        `${asset.name}: ${comment}${mode === "direct_admin" ? " (סגירה מיידית על ידי מנהל מערכת)" : ""}`,
      ),
    );
  }
  function reportFault(room, asset, user, input) {
    const at = new Date().toISOString();
    let fault = faultFor(room, asset.id);
    if (!fault) {
      fault = {
        id: randomUUID(),
        assetId: asset.id,
        assetName: asset.name,
        openedAt: at,
        openedBy: user.name,
        openedById: user.id,
        history: [],
        closureNote: "",
      };
      room.faults.push(fault);
    }
    Object.assign(fault, {
      status: input.status || "faulty",
      description: input.description,
      severity: input.severity,
      assigneeId: input.assigneeId || "",
      assigneeText: input.assigneeText || "",
      slaAt: input.slaAt,
    });
    fault.history.push({
      at,
      actor: user.name,
      actorId: user.id,
      status: fault.status,
      note: input.description,
    });
    Object.assign(asset, {
      status: fault.status,
      severity: fault.severity,
      note: input.description,
    });
  }
  app.post("/api/rooms", manager, async (req, res) => {
    const input = parse(
        z.object({ name: short, type: z.enum(ROOM_TYPES) }),
        req.body,
      ),
      rid = randomUUID();
    await rooms.insertOne({
      _id: rid,
      id: rid,
      ...input,
      version: 1,
      maintenance: false,
      note: "",
      lastCheck: null,
      assets: [],
      faults: [],
      requests: [],
      mailEvents: [],
      audit: [audit(req.user, "יצירת מרחב", input.name)],
      plan: {
        width: 1000,
        height: 650,
        shape: "rectangle",
        points: [],
        walls: [],
        tables: [],
      },
      demo: false,
    });
    res.status(201).json({ id: rid });
  });
  app.patch("/api/rooms/:id", async (req, res) => {
    const room = await roomFor(req, true),
      { version, ...input } = parse(
        z.object({
          version: z.number().int(),
          name: short.optional(),
          type: z.enum(ROOM_TYPES).optional(),
          note: z.string().max(2000).optional(),
          maintenance: z.boolean().optional(),
          scheduleOverride: scheduleSchema.nullable().optional(),
        }),
        req.body,
      );
    if (
      !isManager(req.user) &&
      ["note", "maintenance", "scheduleOverride"].some((key) => key in input)
    )
      throw fail(
        403,
        "הערכת מנהל מערכת, השבתה מתוכננת ומועדי בדיקה ניתנים לעריכה בידי מנהל מערכת בלבד",
      );
    Object.assign(room, input);
    room.audit.push(
      audit(
        req.user,
        "עדכון מרחב",
        "פרטי מרחב, לוח בדיקות או הערכת מנהל מערכת",
      ),
    );
    await saveRoom(room, version);
    res.json({ ok: true });
  });
  app.post("/api/rooms/:id/assets/bulk", async (req, res) => {
    const room = await roomFor(req, true);
    const input = parse(
      z.object({
        version: z.number().int(),
        assets: z.array(assetSchema).min(1).max(250),
      }),
      req.body,
    );
    if (activeAssets(room).length + input.assets.length > 250)
      throw fail(400, "ניתן להגדיר עד 250 אמצעים פעילים במרחב");
    const added = input.assets.map((asset) => ({
      id: randomUUID(),
      ...cleanAsset(asset),
      status: "healthy",
      severity: "high",
      note: "",
      archived: false,
    }));
    room.assets.push(...added);
    added.forEach((a, i) =>
      applyDependents(room, a, input.assets[i].dependentIds),
    );
    validateDependencies(room);
    room.lastCheck = null;
    for (const asset of added)
      room.audit.push(audit(req.user, "הוספת אמצעי", asset.name));
    await saveRoom(room, input.version);
    res.status(201).json({ ids: added.map((a) => a.id) });
  });
  app.post("/api/rooms/:id/assets", async (req, res) => {
    const room = await roomFor(req, true),
      input = parse(
        z.object({ version: z.number().int(), asset: assetSchema }),
        req.body,
      );
    if (activeAssets(room).length >= 250)
      throw fail(400, "ניתן להגדיר עד 250 אמצעים פעילים במרחב");
    const aid = randomUUID(),
      a = {
        id: aid,
        ...cleanAsset(input.asset),
        status: "healthy",
        severity: "high",
        note: "",
        archived: false,
      };
    room.assets.push(a);
    applyDependents(room, a, input.asset.dependentIds);
    validateDependencies(room);
    room.lastCheck = null;
    room.audit.push(audit(req.user, "הוספת אמצעי", a.name));
    await saveRoom(room, input.version);
    res.status(201).json({ id: aid });
  });
  app.patch("/api/rooms/:id/assets/:assetId", async (req, res) => {
    const room = await roomFor(req, true),
      input = parse(
        z.object({ version: z.number().int(), asset: assetSchema }),
        req.body,
      ),
      a = activeAssets(room).find((a) => a.id === req.params.assetId);
    if (!a) throw fail(404, "האמצעי אינו נמצא במלאי הפעיל");
    Object.assign(a, cleanAsset(input.asset));
    applyDependents(room, a, input.asset.dependentIds);
    validateDependencies(room);
    room.lastCheck = null;
    room.audit.push(audit(req.user, "עדכון אמצעי", a.name));
    await saveRoom(room, input.version);
    res.json({ ok: true });
  });
  app.delete("/api/rooms/:id/assets/:assetId", async (req, res) => {
    const room = await roomFor(req, true),
      input = parse(
        z.object({ version: z.number().int(), reason: note }),
        req.body,
      ),
      a = activeAssets(room).find((a) => a.id === req.params.assetId);
    if (!a) throw fail(404, "האמצעי אינו נמצא במלאי הפעיל");
    const open = faultFor(room, a.id);
    if (open)
      closeFault(
        room,
        open,
        a,
        req.user,
        "הוסר מהמלאי: " + input.reason,
        "asset_retired",
      );
    Object.assign(a, {
      archived: true,
      archivedAt: new Date().toISOString(),
      archivedBy: req.user.name,
      archiveReason: input.reason,
    });
    for (const child of activeAssets(room)) {
      child.parentIds = dependencyIds(child).filter((pid) => pid !== a.id);
      child.parentId = null;
      child.dependency = child.parentIds.length ? "hard" : "none";
      child.backupIds = (child.backupIds || []).filter((x) => x !== a.id);
    }
    room.lastCheck = null;
    room.audit.push(
      audit(
        req.user,
        "הסרת אמצעי מהמלאי",
        `${a.name}: ${input.reason}. היסטוריית האמצעי נשמרה.`,
      ),
    );
    await saveRoom(room, input.version);
    res.json({ ok: true });
  });
  app.post(
    "/api/rooms/:id/assets/:assetId/restore",
    manager,
    async (req, res) => {
      const room = await roomFor(req, true),
        { version } = parse(z.object({ version: z.number().int() }), req.body),
        a = room.assets.find((a) => a.id === req.params.assetId && a.archived);
      if (!a) throw fail(404, "האמצעי אינו בארכיון");
      if (activeAssets(room).length >= 250) throw fail(400, "המלאי הפעיל מלא");
      Object.assign(a, {
        archived: false,
        parentId: null,
        parentIds: [],
        dependency: "none",
        backupIds: [],
        status: "healthy",
      });
      room.lastCheck = null;
      room.audit.push(audit(req.user, "שחזור אמצעי", a.name));
      await saveRoom(room, version);
      res.json({ ok: true });
    },
  );
  app.put("/api/rooms/:id/plan", async (req, res) => {
    const room = await roomFor(req, true),
      input = parse(
        z.object({
          version: z.number().int(),
          plan: planSchema,
          positions: z
            .array(
              z.object({
                id,
                x: z.number().min(2).max(98),
                y: z.number().min(2).max(98),
                rotation: z.number().min(0).max(360).default(0),
              }),
            )
            .max(250),
        }),
        req.body,
      );
    validatePlan(input.plan);
    if (
      new Set(input.positions.map((p) => p.id)).size !== input.positions.length
    )
      throw fail(400, "מיקום כפול לאותו אמצעי");
    room.plan = input.plan;
    for (const p of input.positions) {
      const a = activeAssets(room).find((a) => a.id === p.id);
      if (!a) throw fail(400, "האמצעי אינו פעיל");
      Object.assign(a, { x: p.x, y: p.y, rotation: p.rotation });
    }
    room.audit.push(
      audit(req.user, "עדכון שרטוט", "קירות, ריהוט ומיקומי ציוד"),
    );
    await saveRoom(room, input.version);
    res.json({ ok: true });
  });
  const outcomeSchema = z.object({
    assetId: id,
    action: z.enum(["pass", "keep", "fault", "close"]),
    note: z.string().trim().max(2000).default(""),
    severity: z.enum(["low", "medium", "high"]).default("high"),
    status: z.enum(["faulty", "in_progress", "waiting"]).default("faulty"),
    assigneeId: z.string().default(""),
    assigneeText: z.string().trim().max(200).default(""),
    slaAt: timestamp.optional(),
    verified: z.boolean().default(false),
  });
  app.post("/api/rooms/:id/check", async (req, res) => {
    const room = await roomFor(req, true),
      input = parse(
        z.object({
          version: z.number().int(),
          scope: z.enum(["full", "selected"]),
          roundId: id.nullable().default(null),
          outcomes: z.array(outcomeSchema).min(1).max(250),
        }),
        req.body,
      ),
      settings = await getSettings();
    if (room.maintenance)
      throw fail(409, "יש להחזיר את המרחב לפעילות לפני בדיקה");
    if ((settings.round?.id || null) !== input.roundId)
      throw fail(409, "סבב הבדיקה השתנה. יש לרענן ולנסות שוב");
    const initiallyImpacted = new Set(
      readiness(room, settings)
        .assets.filter((a) => a.loss > 0)
        .map((a) => a.id),
    );
    const available = activeAssets(room).filter(
        (a) => a.status !== "maintenance",
      ),
      selected = new Set(input.outcomes.map((o) => o.assetId));
    if (selected.size !== input.outcomes.length)
      throw fail(400, "אמצעי נבחר יותר מפעם אחת");
    if (
      input.scope === "full" &&
      (selected.size !== available.length ||
        available.some((a) => !selected.has(a.id)))
    )
      throw fail(400, "בדיקה מלאה חייבת לכלול את כל האמצעים הפעילים");
    for (const item of input.outcomes) {
      const a = available.find((a) => a.id === item.assetId);
      if (!a) throw fail(400, "האמצעי אינו זמין לבדיקה");
      const f = faultFor(room, a.id);
      if (item.action === "pass" && f)
        throw fail(
          409,
          "קיים פער פתוח באמצעי. יש לבחור סגירת פער או השארת הפער פתוח",
        );
      if (item.action === "close") {
        if (!f) throw fail(400, "לא נמצא פער פתוח לסגירה");
        if (item.note.length < 3) throw fail(400, "נדרשת הערת סגירה");
        if (!isManager(req.user) && !item.verified)
          throw fail(400, "לסגירת הפער יש לאשר שהתקלה באמצעי נבדקה ותוקנה");
        closeFault(
          room,
          f,
          a,
          req.user,
          item.note,
          isManager(req.user) ? "direct_admin" : "verified_during_check",
        );
      }
      if (item.action === "fault") {
        if (item.note.length < 3) throw fail(400, "נדרש תיאור לפער");
        await assignee(item.assigneeId, room.id);
        reportFault(room, a, req.user, {
          ...item,
          description: item.note,
          slaAt:
            item.slaAt ||
            new Date(
              Date.now() + (settings.defaultSlaHours || 24) * 3600000,
            ).toISOString(),
        });
      }
      Object.assign(a, {
        checkedAt: new Date().toISOString(),
        checkedBy: req.user.name,
        checkedById: req.user.id,
      });
    }
    // Record the component's own result separately from its derived operational status.
    // A new upstream fault may affect otherwise healthy components in this same batch.
    const metrics = readiness(room, settings);
    for (const o of input.outcomes) {
      const asset = available.find((a) => a.id === o.assetId);
      const metric = metrics.assets.find((a) => a.id === o.assetId);
      if (
        o.action === "keep" &&
        !faultFor(room, asset.id) &&
        !initiallyImpacted.has(asset.id) &&
        metric.loss === 0 &&
        !metric.planned
      )
        throw fail(400, "לא נמצא פער פתוח או רכיב תקול המשפיע על האמצעי שנבחר");
      asset.lastCheckResult = {
        action: o.action,
        affectedByIds: metric.causeIds.filter((id) => id !== asset.id),
        planned: metric.planned,
      };
    }
    const checked = {
      at: new Date().toISOString(),
      actor: req.user.name,
      actorId: req.user.id,
      roundId: settings.round?.id || null,
      assetIds: [...selected],
      scope: input.scope,
    };
    if (input.scope === "full") room.lastCheck = checked;
    else room.lastPartialCheck = checked;
    for (const request of room.requests || []) {
      if (request.status !== "approved") continue;
      const required =
        request.scope === "full"
          ? available.map((a) => a.id)
          : request.assetIds.filter((aid) =>
              available.some((a) => a.id === aid),
            );
      if (request.scope === "full" && input.scope !== "full") continue;
      if (required.length && required.every((aid) => selected.has(aid))) {
        request.status = "completed";
        request.completedAt = checked.at;
        request.completedBy = req.user.name;
        request.history.push({
          at: checked.at,
          actor: req.user.name,
          status: "completed",
          note: "הבדיקה בוצעה ותוצאותיה נשמרו",
        });
        emit(room, "request_completed", request, req.user, request.reason);
      }
    }
    room.audit.push(
      audit(
        req.user,
        input.scope === "full" ? "בדיקת כשירות" : "בדיקה ממוקדת",
        `${selected.size} אמצעים; ${input.outcomes.filter((o) => o.action === "close").length} פערים נסגרו; ${input.outcomes.filter((o) => o.action === "fault").length} פערים דווחו`,
      ),
    );
    await saveRoom(room, input.version);
    res.json({ ok: true, scope: input.scope });
  });
  app.patch("/api/rooms/:id/faults/:faultId", async (req, res) => {
    const room = await roomFor(req, true),
      input = parse(
        z.object({
          version: z.number().int(),
          status: z.enum([
            "faulty",
            "in_progress",
            "waiting",
            "repaired",
            "closed",
          ]),
          note,
          assigneeId: z.string().default(""),
          assigneeText: z.string().trim().max(200).default(""),
          slaAt: timestamp,
          severity: z.enum(["low", "medium", "high"]),
        }),
        req.body,
      ),
      fault = room.faults.find(
        (f) => f.id === req.params.faultId && f.status !== "closed",
      ),
      asset = activeAssets(room).find((a) => a.id === fault?.assetId);
    if (!fault || !asset) throw fail(404, "הפער אינו פתוח");
    const direct = isManager(req.user) && input.status === "closed";
    if (
      !direct &&
      fault.status !== input.status &&
      !TRANSITIONS[fault.status].includes(input.status)
    )
      throw fail(409, "מעבר סטטוס אינו אפשרי ללא תיקון ואימות");
    await assignee(input.assigneeId, room.id);
    Object.assign(fault, {
      assigneeId: input.assigneeId,
      assigneeText: input.assigneeText,
    });
    if (input.status === "closed") {
      closeFault(
        room,
        fault,
        asset,
        req.user,
        input.note,
        direct ? "direct_admin" : "verified",
      );
    } else {
      Object.assign(fault, {
        status: input.status,
        severity: input.severity,
        assigneeId: input.assigneeId,
        assigneeText: input.assigneeText,
        slaAt: input.slaAt,
      });
      fault.history.push({
        at: new Date().toISOString(),
        actor: req.user.name,
        actorId: req.user.id,
        status: input.status,
        note: input.note,
      });
      Object.assign(asset, {
        status: input.status,
        severity: input.severity,
        note: input.note,
      });
      room.audit.push(
        audit(
          req.user,
          "עדכון פער",
          asset.name + " — " + STATUSES[input.status],
        ),
      );
    }
    await saveRoom(room, input.version);
    res.json({ ok: true });
  });
  app.post(
    "/api/rooms/:id/assets/:assetId/maintenance",
    manager,
    async (req, res) => {
      const room = await roomFor(req, true),
        input = parse(
          z.object({ version: z.number().int(), enabled: z.boolean(), note }),
          req.body,
        ),
        a = activeAssets(room).find((a) => a.id === req.params.assetId);
      if (!a) throw fail(404, "האמצעי אינו פעיל");
      if (faultFor(room, a.id))
        throw fail(409, "יש לסגור את הפער לפני מעבר לתחזוקה");
      a.status = input.enabled ? "maintenance" : "healthy";
      a.note = input.note;
      room.lastCheck = null;
      room.audit.push(
        audit(req.user, "תחזוקה מתוכננת", `${a.name}: ${input.note}`),
      );
      await saveRoom(room, input.version);
      res.json({ ok: true });
    },
  );
  app.post("/api/rooms/:id/requests", async (req, res) => {
    const room = await roomFor(req);
    if (!isManager(req.user) && req.user.role !== "commander")
      throw fail(403, "בקשת בדיקה מותרת למפקד החמ״ל או למנהל מערכת");
    const input = parse(
      z.object({
        version: z.number().int(),
        requestedFor: timestamp,
        reason: note,
        details: note,
        scope: z.enum(["full", "selected"]),
        assetIds: z.array(id).max(250).default([]),
      }),
      req.body,
    );
    if (new Date(input.requestedFor).getTime() < Date.now() - 60000)
      throw fail(400, "מועד הבדיקה המבוקש עבר");
    if (
      input.scope === "selected" &&
      (!input.assetIds.length ||
        input.assetIds.some(
          (aid) => !activeAssets(room).some((a) => a.id === aid),
        ))
    )
      throw fail(400, "יש לבחור אמצעים פעילים לבדיקה ממוקדת");
    const request = {
      id: randomUUID(),
      requestedById: req.user.id,
      requestedBy: req.user.name,
      createdAt: new Date().toISOString(),
      requestedFor: input.requestedFor,
      reason: input.reason,
      details: input.details,
      scope: input.scope,
      assetIds: input.scope === "full" ? [] : [...new Set(input.assetIds)],
      status: "pending",
      history: [
        {
          at: new Date().toISOString(),
          actor: req.user.name,
          status: "pending",
          note: input.reason,
        },
      ],
    };
    room.requests ||= [];
    room.requests.push(request);
    emit(room, "request_created", request, req.user, request.reason);
    room.audit.push(audit(req.user, "בקשת בדיקה", request.reason));
    await saveRoom(room, input.version);
    res.status(201).json({ id: request.id });
  });
  app.patch("/api/rooms/:id/requests/:requestId", async (req, res) => {
    const room = await roomFor(req),
      input = parse(
        z.object({
          version: z.number().int(),
          decision: z.enum(["approved", "rejected", "cancelled"]),
          note,
        }),
        req.body,
      ),
      request = (room.requests || []).find(
        (r) => r.id === req.params.requestId,
      );
    if (!request) throw fail(404, "בקשה לא נמצאה");
    if (input.decision === "cancelled") {
      if (
        !isManager(req.user) &&
        !(
          req.user.role === "commander" &&
          request.requestedById === req.user.id &&
          request.status === "pending"
        )
      )
        throw fail(403, "אין הרשאה לבטל בקשה זו");
      if (!["pending", "approved"].includes(request.status))
        throw fail(409, "הבקשה אינה פעילה");
    } else {
      if (!isManager(req.user))
        throw fail(403, "רק מנהל מערכת רשאי לאשר או לדחות");
      if (request.status !== "pending") throw fail(409, "הבקשה כבר טופלה");
    }
    Object.assign(request, {
      status: input.decision,
      reviewedAt: new Date().toISOString(),
      reviewedBy: req.user.name,
      reviewNote: input.note,
    });
    request.history.push({
      at: new Date().toISOString(),
      actor: req.user.name,
      status: input.decision,
      note: input.note,
    });
    emit(room, "request_" + input.decision, request, req.user, input.note);
    room.audit.push(
      audit(req.user, "החלטה בבקשת בדיקה", input.decision + ": " + input.note),
    );
    await saveRoom(room, input.version);
    res.json({ ok: true });
  });
}

exports.installRoomRoutes = installRoomRoutes;
