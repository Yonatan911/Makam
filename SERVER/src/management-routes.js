"use strict";
const { z } = require("zod");
const { randomUUID } = require("node:crypto");
const sharp = require("sharp");
const express = require("express");
const {
  ROLES,
  isManager,
  activeAssets,
  readiness,
} = require("../shared/model.js");
const { parse, fail, id, short, scheduleSchema } = require("./validation.js");
const { safeUser } = require("./security.js");
function installManagementRoutes(ctx) {
  const {
    app,
    db,
    users,
    rooms,
    manager,
    owner,
    getSettings,
    saveSettings,
    audit,
    config,
  } = ctx;
  app.patch("/api/settings", manager, async (req, res) => {
    const input = parse(
        z
          .object({
            version: z.number().int(),
            baseName: short,
            freshnessDays: z.number().int().min(1).max(90),
            note: z.string().max(2000),
            schedule: scheduleSchema,
            remindersEnabled: z.boolean(),
            reminderDay: z.number().int().min(0).max(6),
            reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
            requestMailEnabled: z.boolean(),
            recipients: z.array(z.email()).max(100),
          })
          .strict(),
        req.body,
      ),
      settings = await getSettings();
    if (
      (input.remindersEnabled || input.requestMailEnabled) &&
      (!process.env.SMTP_HOST || !process.env.SMTP_FROM)
    )
      throw fail(400, "לפני הפעלת דוא״ל יש להגדיר שרת SMTP פנימי וכתובת שולח");
    if (input.remindersEnabled && !input.recipients.length)
      throw fail(400, "יש להגדיר נמענים לתזכורות");
    const { version, ...patch } = input;
    Object.assign(settings, patch);
    await saveSettings(settings, version);
    await db
      .collection("adminAudit")
      .insertOne(
        audit(
          req.user,
          "הגדרות מערכת",
          "עדכון מועדי בדיקות, תזכורות והערכת מנהל מערכת",
        ),
      );
    res.json({ ok: true });
  });
  app.patch("/api/owner/settings", owner, async (req, res) => {
    const input = parse(
      z
        .object({
          version: z.number().int(),
          appName: short,
          accentColor: z.string().regex(/^#[a-fA-F0-9]{6}$/),
          defaultTheme: z.enum(["light", "dark"]),
          density: z.enum(["comfortable", "compact"]),
          networks: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
          defaultSlaHours: z.number().int().min(1).max(720),
          scoring: z.object({
            critical: z.number().min(1).max(20),
            regular: z.number().min(0.1).max(10),
            low: z.number().min(0.01).max(1),
            medium: z.number().min(0.01).max(1),
            high: z.number().min(0.01).max(1),
          }),
        })
        .strict(),
      req.body,
    );
    if (
      input.scoring.low > input.scoring.medium ||
      input.scoring.medium > input.scoring.high ||
      input.scoring.critical < input.scoring.regular
    )
      throw fail(
        400,
        "משקל קריטי לא יכול להיות נמוך ממשקל רגיל, והחומרות צריכות להיות בסדר עולה",
      );
    const settings = await getSettings(),
      { version, ...patch } = input;
    Object.assign(settings, patch);
    await saveSettings(settings, version);
    await db
      .collection("adminAudit")
      .insertOne(
        audit(req.user, "התאמה אישית של הבעלים", JSON.stringify(patch)),
      );
    res.json({ ok: true });
  });
  app.get("/api/owner/diagnostics", owner, async (req, res) => {
    const build = await db.admin().command({ buildInfo: 1 });
    res.json({
      version: "2.0.5",
      node: process.version,
      mongodb: build.version,
      authentication: config.authMode,
      testMode: config.testMode,
      smtpConfigured: !!process.env.SMTP_HOST,
      ldapConfigured: !!process.env.LDAP_URL,
      sharepointOriginConfigured: !!process.env.SHAREPOINT_ORIGIN,
      localAssets: true,
      users: await users.countDocuments(),
      rooms: await rooms.countDocuments(),
      outbox: await db
        .collection("mailOutbox")
        .aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
        .toArray(),
    });
  });
  app.get("/api/notifications", manager, async (req, res) =>
    res.json(
      await db
        .collection("mailOutbox")
        .find(
          {},
          {
            projection: {
              _id: 0,
              id: 1,
              createdAt: 1,
              sentAt: 1,
              status: 1,
              subject: 1,
              lastError: 1,
            },
          },
        )
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
    ),
  );
  app.post("/api/notifications/:id/retry", manager, async (req, res) => {
    const result = await db.collection("mailOutbox").updateOne(
      {
        id: req.params.id,
        $or: [
          { status: { $in: ["waiting_configuration", "no_recipients"] } },
          { status: "failed", attemptedAt: { $exists: false } },
        ],
      },
      { $set: { status: "pending", lastError: "" } },
    );
    if (!result.matchedCount)
      throw fail(409, "ניתן לנסות שוב רק הודעה שנכשלה או ממתינה להגדרה");
    await db
      .collection("adminAudit")
      .insertOne(audit(req.user, "ניסיון חוזר לשליחת דוא״ל", req.params.id));
    res.json({ ok: true });
  });
  app.get("/api/audit", manager, async (req, res) => {
    const data = await rooms.find().toArray(),
      logs = data.flatMap((r) =>
        (r.audit || []).map((a) => ({ ...a, roomName: r.name })),
      );
    logs.push(...(await db.collection("adminAudit").find().toArray()));
    res.json(logs.sort((a, b) => b.at.localeCompare(a.at)));
  });
  app.post("/api/rounds", manager, async (req, res) => {
    const { name, type } = parse(
        z.object({
          name: z.string().trim().min(3).max(200),
          type: z.enum(["all", "חמ״ל", "חד״ן"]).default("all"),
        }),
        req.body,
      ),
      selected = await rooms
        .find({ maintenance: false, ...(type === "all" ? {} : { type }) })
        .toArray();
    if (!selected.length) throw fail(400, "אין מרחבים פעילים לסבב");
    const round = {
      id: randomUUID(),
      name,
      type,
      startedAt: new Date().toISOString(),
      startedBy: req.user.name,
      roomIds: selected.map((r) => r.id),
    };
    await db
      .collection("settings")
      .updateOne({ _id: "main" }, { $set: { round }, $inc: { version: 1 } });
    await db
      .collection("adminAudit")
      .insertOne(audit(req.user, "הפעלת סבב בדיקה", name));
    res.json({ ok: true });
  });
  app.post("/api/demo/clear", owner, async (req, res) => {
    parse(z.object({ confirmation: z.literal("מחיקת נתוני דוגמה") }), req.body);
    await rooms.deleteMany({ demo: true });
    await db.collection("settings").updateOne(
      { _id: "main" },
      {
        $set: { demo: false, round: null, "baseMap.markers": [] },
        $inc: { version: 1 },
      },
    );
    await db
      .collection("adminAudit")
      .insertOne(
        audit(req.user, "הסרת נתוני דוגמה", "נתוני עבודה שאינם דוגמה נשמרו"),
      );
    res.json({ ok: true });
  });
  // Images never enter the public static directory; only authenticated users can read the active image.
  app.post(
    "/api/base-map/image",
    manager,
    express.raw({
      type: ["image/png", "image/jpeg", "image/webp"],
      limit: "10mb",
    }),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body))
        throw fail(400, "יש לבחור תמונת PNG, JPEG או WebP");
      let bytes;
      try {
        const image = sharp(req.body, {
          limitInputPixels: 25000000,
          animated: false,
        });
        const meta = await image.metadata();
        if (!["png", "jpeg", "webp"].includes(meta.format))
          throw new Error("Unsupported image");
        bytes = await image
          .rotate()
          .resize({
            width: 2400,
            height: 2400,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 88 })
          .toBuffer();
      } catch {
        throw fail(
          400,
          "התמונה אינה תקינה או גדולה מדי. יש להשתמש בתמונה עד 25 מיליון פיקסלים.",
        );
      }
      const imageId = randomUUID();
      await db.collection("media").insertOne({
        _id: imageId,
        id: imageId,
        data: bytes,
        mime: "image/webp",
        createdBy: req.user.id,
        createdAt: new Date(),
      });
      await db
        .collection("settings")
        .updateOne(
          { _id: "main" },
          { $set: { "baseMap.imageId": imageId }, $inc: { version: 1 } },
        );
      await db
        .collection("adminAudit")
        .insertOne(
          audit(
            req.user,
            "עדכון תמונה אווירית",
            "תמונה מקומית הועלתה ומידע נלווה הוסר",
          ),
        );
      res.status(201).json({ id: imageId });
    },
  );
  app.get("/api/base-map/image/:id", async (req, res) => {
    const settings = await getSettings();
    if (settings.baseMap?.imageId !== req.params.id)
      throw fail(404, "תמונה לא נמצאה");
    const media = await db.collection("media").findOne({ _id: req.params.id });
    if (!media) throw fail(404, "תמונה לא נמצאה");
    res
      .type("image/webp")
      .set("Cache-Control", "private, no-store")
      .send(Buffer.from(media.data.buffer));
  });
  app.put("/api/base-map/markers", manager, async (req, res) => {
    const input = parse(
      z.object({
        version: z.number().int(),
        markers: z
          .array(
            z.object({
              roomId: id,
              x: z.number().min(0).max(100),
              y: z.number().min(0).max(100),
            }),
          )
          .max(500),
      }),
      req.body,
    );
    if (
      new Set(input.markers.map((m) => m.roomId)).size !==
        input.markers.length ||
      (await rooms.countDocuments({
        id: { $in: input.markers.map((m) => m.roomId) },
      })) !== input.markers.length
    )
      throw fail(400, "יש לבחור כל מרחב פעם אחת בלבד");
    const settings = await getSettings();
    settings.baseMap = { ...settings.baseMap, markers: input.markers };
    await saveSettings(settings, input.version);
    await db
      .collection("adminAudit")
      .insertOne(
        audit(req.user, "עדכון מפת בסיס", "מיקומי מרחבים בתמונה האווירית"),
      );
    res.json({ ok: true });
  });
}

exports.installManagementRoutes = installManagementRoutes;
