"use strict";
const express = require("express");
const helmet = require("helmet");
const { randomUUID } = require("node:crypto");
const { BSON } = require("mongodb");
const { installAuth } = require("./auth.js");
const { installRoomRoutes } = require("./room-routes.js");
const { installManagementRoutes } = require("./management-routes.js");
const { installReportRoutes } = require("./report-routes.js");
const { canRead, canWrite, safeUser } = require("./security.js");
const { fail } = require("./validation.js");
const {
  isManager,
  publicRoom,
  aggregate,
  readiness,
  freshness,
} = require("../shared/model.js");
async function createApp({ db, config: configuration }) {
  const config = { ...configuration };
  const rawDb = db;
  db = require("./tenancy.js").tenantDatabase(rawDb);
  const users = db.collection("users"),
    rooms = db.collection("rooms"),
    settingsCollection = db.collection("settings");
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  const allowedHosts = new Set(
    config.allowedOrigins.map((u) => new URL(u).host),
  );
  if (typeof config.listenTarget === "number") {
    allowedHosts.add("127.0.0.1:" + config.listenTarget);
    allowedHosts.add("localhost:" + config.listenTarget);
  }
  app.use((req, res, next) => {
    if (!allowedHosts.has(req.get("host")))
      return res.status(403).json({ error: "כתובת מארח אינה מורשית" });
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: false,
      strictTransportSecurity: config.production ? void 0 : false,
    }),
  );
  if (config.apiPrefix)
    app.use((req, res, next) => {
      if (
        req.url === config.apiPrefix ||
        req.url.startsWith(config.apiPrefix + "/")
      )
        req.url = req.url.slice(config.apiPrefix.length) || "/";
      else return res.status(404).json({ error: "נתיב API אינו תקין" });
      next();
    });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.vary("Origin");
    const origin = req.get("Origin");
    if (origin && !config.allowedOrigins.includes(origin))
      return res.status(403).json({ error: "מקור הבקשה אינו מורשה" });
    if (origin) {
      res.set("Access-Control-Allow-Origin", origin);
      if (config.authMode !== "sharepoint-library")
        res.set("Access-Control-Allow-Credentials", "true");
      res.set("Access-Control-Expose-Headers", "Content-Disposition");
    }
    if (req.method === "OPTIONS") {
      if (!origin) return res.sendStatus(403);
      const headers = (req.get("Access-Control-Request-Headers") || "")
        .toLowerCase()
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      if (
        headers.some(
          (x) =>
            ![
              "authorization",
              "content-type",
              "x-readiness-client",
              "x-base-id",
            ].includes(x),
        ) ||
        !["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(
          req.get("Access-Control-Request-Method"),
        )
      )
        return res.sendStatus(403);
      res.set(
        "Access-Control-Allow-Headers",
        "Authorization,Content-Type,X-Readiness-Client,X-Base-Id",
      );
      res.set(
        "Access-Control-Allow-Methods",
        "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
      );
      return res.sendStatus(204);
    }
    const exchange =
      ["/auth/session", "/auth/session.js"].includes(req.path) &&
      req.method === "POST" &&
      config.authMode === "iis-session";
    if (
      !["GET", "HEAD"].includes(req.method) &&
      ((exchange ? false : req.get("X-Readiness-Client") !== "dashboard") ||
        ((config.production || exchange) && !origin))
    )
      return res.status(403).json({ error: "הבקשה אינה מגיעה ממקור מורשה" });
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.get("/api/health", async (req, res) => {
    await rawDb.command({ ping: 1 });
    res.json({
      ok: true,
      service: "makam",
      database: "connected",
      authMode: config.authMode,
      version: "3.1.0-multibase",
    });
  });
  const auth =
    config.authMode === "sharepoint-library" && !config.production
      ? await require("../legacy/auth.js").installAuth(app, rawDb, config)
      : installAuth(app, rawDb, config);
  await require("./tenancy.js").installTenancy(app, rawDb);
  config.testMode = auth.testMode;
  const getSettings = () => settingsCollection.findOne({ _id: "main" });
  const audit = (user, action, detail) => ({
    id: randomUUID(),
    at: new Date().toISOString(),
    actorId: user.id,
    actor: user.name,
    action,
    detail,
    testMode: config.testMode,
  });
  const manager = (req, res, next) => {
    if (!isManager(req.user)) throw fail(403, "הפעולה מותרת למנהל מערכת בלבד");
    next();
  };
  const owner = (req, res, next) => {
    if (req.user.role !== "owner") throw fail(403, "הפעולה מותרת לבעלים בלבד");
    next();
  };
  async function roomFor(req, write = false) {
    const room = await rooms.findOne({ id: req.params.id });
    if (!room || !(write ? canWrite : canRead)(req.user, room.id))
      throw fail(404, "המרחב אינו קיים או אינו מורשה");
    return room;
  }
  async function saveRoom(room, version) {
    if (room.version !== version)
      throw fail(
        409,
        "המרחב עודכן בינתיים. יש לרענן ולפתוח את הטופס מחדש; השינוי שלך לא נשמר.",
      );
    if (BSON.calculateObjectSize(room) > 15 * 1024 * 1024)
      throw fail(413, "יומן המרחב מלא. נדרש ארכוב נתונים על ידי צוות התשתיות.");
    const previous = room.version;
    room.version++;
    if (
      !(await rooms.replaceOne({ id: room.id, version: previous }, room))
        .matchedCount
    )
      throw fail(409, "בוצע עדכון מקביל. יש לרענן לפני שמירה נוספת.");
  }
  async function saveSettings(settings, version) {
    if (settings.version !== version)
      throw fail(409, "ההגדרות עודכנו בינתיים. יש לרענן לפני שמירה.");
    settings.version++;
    if (
      !(await settingsCollection.replaceOne({ _id: "main", version }, settings))
        .matchedCount
    )
      throw fail(409, "בוצע עדכון מקביל להגדרות. יש לרענן.");
  }
  app.get("/api/state", async (req, res) => {
    if (req.noBase)
      return res.json({
        user: safeUser(req.user),
        base: null,
        bases: [],
        testMode: config.testMode,
        settings: { defaultTheme: "light", appName: "מכ״ם" },
      });
    const settings = await getSettings(),
      all = await rooms.find().toArray(),
      data = all.filter((r) => canRead(req.user, r.id)),
      managerUser = isManager(req.user),
      projected = data.map((r) => publicRoom(r, req.user, settings));
    const mapAll = managerUser || req.user.role === "technician",
      markers = (settings.baseMap?.markers || [])
        .filter((m) => mapAll || canRead(req.user, m.roomId))
        .map((m) => {
          const r = all.find((r) => r.id === m.roomId);
          return r
            ? {
                ...m,
                name: r.name,
                type: r.type,
                score: readiness(r, settings).overall.score,
                freshness: freshness(r, settings),
                canOpen: canRead(req.user, r.id),
              }
            : null;
        })
        .filter(Boolean);
    const round = settings.round
      ? {
          id: settings.round.id,
          name: settings.round.name,
          type: settings.round.type,
          startedAt: settings.round.startedAt,
          total: data.filter((r) => settings.round.roomIds.includes(r.id))
            .length,
          completed: data.filter(
            (r) =>
              settings.round.roomIds.includes(r.id) &&
              r.lastCheck?.roundId === settings.round.id,
          ).length,
        }
      : null;
    const safeSettings = {
      version: settings.version,
      baseName: settings.baseName,
      appName: settings.appName,
      accentColor: settings.accentColor,
      defaultTheme: settings.defaultTheme,
      density: settings.density,
      freshnessDays: settings.freshnessDays,
      note: settings.note,
      round,
      demo: settings.demo,
      schedule: settings.schedule,
      scoring: settings.scoring,
      networks: settings.networks,
      defaultSlaHours: settings.defaultSlaHours,
      baseMap: { imageId: settings.baseMap?.imageId, markers },
      ...(managerUser
        ? {
            remindersEnabled: settings.remindersEnabled,
            reminderDay: settings.reminderDay,
            reminderTime: settings.reminderTime,
            requestMailEnabled: settings.requestMailEnabled,
            recipients: settings.recipients,
            smtpConfigured: !!process.env.SMTP_HOST,
          }
        : {}),
    };
    const technicians =
      req.user.role === "viewer"
        ? []
        : (
            await users
              .find({
                role: {
                  $in: ["owner", "command_admin", "admin", "technician"],
                },
                active: true,
              })
              .toArray()
          )
            .filter(
              (u) =>
                managerUser ||
                u.role !== "technician" ||
                u.allRooms === true ||
                u.roomIds.some((id) => data.some((r) => r.id === id)),
            )
            .map((u) => ({
              id: u.id,
              name: u.name,
              role: u.role,
              roomIds: (u.roomIds || []).filter((id) =>
                all.some((r) => r.id === id),
              ),
              allRooms: u.allRooms === true,
            }));
    res.json({
      user: safeUser(req.user),
      base: req.base,
      bases: req.bases,
      testMode: config.testMode,
      authMode: config.authMode,
      settings: safeSettings,
      rooms: projected,
      metrics: aggregate(data, true, settings),
      technicians,
      serverTime: new Date().toISOString(),
    });
  });
  const ctx = {
    app,
    db,
    users,
    rooms,
    manager,
    owner,
    roomFor,
    saveRoom,
    getSettings,
    saveSettings,
    audit,
    config,
  };
  installRoomRoutes(ctx);
  installManagementRoutes(ctx);
  installReportRoutes(ctx);
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "הפעולה אינה קיימת" }),
  );
  app.use((req, res) =>
    res.status(404).json({ error: "הממשק הסטטי נמצא ב־SharePoint" }),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.code === 11e3)
      return res.status(409).json({ error: "שם החשבון כבר קיים במערכת" });
    if (err.type === "entity.too.large")
      return res.status(413).json({ error: "הקובץ או הבקשה גדולים מדי" });
    if (err instanceof SyntaxError && err.status === 400)
      return res.status(400).json({ error: "הבקשה אינה תקינה" });
    if (!err.status || err.status >= 500)
      console.error("Request failed:", err.name, err.code || "");
    res.status(err.status || 500).json({
      error: err.status ? err.message : "אירעה שגיאה בשרת. יש לנסות שוב.",
    });
  });
  return app;
}

exports.createApp = createApp;
