"use strict";
const { rateLimit } = require("express-rate-limit");
const {
  token,
  hash,
  safeUser,
  normalizeWindowsIdentity,
  safeEqual,
} = require("./security.js");
const { syncAdProfile } = require("./ad-profile.js");
const { fail } = require("./validation.js");

function installAuth(app, db, config) {
  const users = db.collection("users"),
    sessions = db.collection("sessions");
  const testMode =
    config.authMode === "local-test" &&
    config.values.ENABLE_LOCAL_TEST_LOGIN === "true" &&
    !config.production;
  const limiter = rateLimit({
    windowMs: 60000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "יותר מדי בקשות כניסה. יש להמתין דקה." },
  });
  const rawCookie = (req) =>
    (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("readiness_session="))
      ?.slice(18);
  const bearer = (req) =>
    /^Bearer ([a-f0-9]{64})$/.exec(req.get("Authorization") || "")?.[1];
  async function sessionFor(user, res, mode) {
    const raw = token(),
      expiresAt = new Date(Date.now() + config.sessionHours * 3600000);
    await sessions.insertOne({
      _id: hash(raw),
      userId: user.id,
      authMode: mode,
      expiresAt,
    });
    if (mode === "local-test" || mode === "local")
      res.cookie("readiness_session", raw, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: "lax",
        path: config.apiPrefix || "/",
        maxAge: config.sessionHours * 3600000,
      });
    return {
      user: safeUser(user),
      ...(mode === "iis-session"
        ? { token: raw, expiresAt: expiresAt.toISOString() }
        : {}),
    };
  }
  async function currentUser(req) {
    // Legacy proxy can only be selected for regression/development, never production.
    if (config.authMode === "windows-proxy" && !config.production) {
      if (
        !safeEqual(
          req.get("X-Readiness-Proxy"),
          config.values.TRUSTED_PROXY_SECRET,
        )
      )
        return null;
      const username = normalizeWindowsIdentity(
        req.get("X-Remote-User"),
        config.adDomain,
      );
      return username
        ? syncAdProfile(
            await users.findOne({
              username,
              active: true,
              testAccount: { $ne: true },
            }),
            users,
          )
        : null;
    }
    const raw =
      config.authMode === "iis-session" ? bearer(req) : rawCookie(req);
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
    const s = await sessions.findOne({
      _id: hash(raw),
      authMode: config.authMode,
      expiresAt: { $gt: new Date() },
    });
    return s
      ? users.findOne({
          id: s.userId,
          active: true,
          ...(config.production ? { testAccount: { $ne: true } } : {}),
        })
      : null;
  }
  app.post(
    ["/api/auth/session", "/api/auth/session.js"],
    limiter,
    async (req, res) => {
      if (
        config.authMode !== "iis-session" ||
        !config.trustedIdentityVerified ||
        typeof config.listenTarget !== "string"
      )
        throw fail(
          401,
          "לא הוגדר גבול אימות IIS מאומת. יש להשלים את בדיקות DevOps.",
        );
      // IISNode promotes AUTH_USER after IIS authentication. IIS rejects all incoming x-iisnode-* headers before promotion.
      const raw = req.rawHeaders || [];
      const count = (name) =>
        raw.filter((v, i) => i % 2 === 0 && v.toLowerCase() === name).length;
      if (
        count("x-iisnode-auth_user") !== 1 ||
        count("x-iisnode-auth_type") !== 1 ||
        !["negotiate", "ntlm", "kerberos"].includes(
          String(req.get("x-iisnode-auth_type")).toLowerCase(),
        )
      )
        throw fail(401, "לא זוהה אימות Windows חד־משמעי ב־IISNode");
      const username = normalizeWindowsIdentity(
        req.get("x-iisnode-auth_user"),
        config.adDomain,
      );
      if (!username) throw fail(401, "לא זוהתה זהות Windows מאומתת ב־IIS");
      const user = await users.findOne({
        username,
        active: true,
        testAccount: { $ne: true },
      });
      if (!user)
        throw fail(403, "החשבון אינו פעיל או לא הוקצתה לו הרשאה ידנית במכ״ם");
      res
        .status(201)
        .json(
          await sessionFor(
            await syncAdProfile(user, users),
            res,
            "iis-session",
          ),
        );
    },
  );
  app.get("/api/auth/me", async (req, res) => {
    const u = await currentUser(req);
    res.json({
      user: u ? safeUser(u) : null,
      authMode: config.authMode,
      testMode,
    });
  });
  app.get("/api/auth/local-users", async (req, res) => {
    if (!testMode) throw fail(404, "פעולה אינה זמינה");
    res.json(
      (await users.find({ active: true }).toArray()).map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        username: u.username,
        testAccount: !!u.testAccount,
      })),
    );
  });
  app.post("/api/auth/local-login", limiter, async (req, res) => {
    if (!testMode) throw fail(404, "פעולה אינה זמינה");
    const user = await users.findOne({ id: req.body?.userId, active: true });
    if (!user) throw fail(404, "המשתמש אינו זמין");
    const raw = rawCookie(req);
    if (raw) await sessions.deleteOne({ _id: hash(raw) });
    await db.collection("adminAudit").insertOne({
      id: require("node:crypto").randomUUID(),
      at: new Date().toISOString(),
      actorId: user.id,
      actor: user.name,
      action: "החלפת זהות בדיקה",
      detail: user.username,
      testMode: true,
    });
    res.json(await sessionFor(user, res, "local-test"));
  });
  app.post("/api/auth/launch", limiter, async (req, res) => {
    if (!["local", "local-test"].includes(config.authMode) || config.production)
      throw fail(404, "פעולה אינה זמינה");
    const raw = req.body?.key;
    if (typeof raw !== "string" || !/^[a-f0-9]{64}$/.test(raw))
      throw fail(400, "קישור לא תקין");
    const launch = await db
      .collection("launchTokens")
      .findOneAndDelete({ _id: hash(raw), expiresAt: { $gt: new Date() } });
    const user =
      launch && (await users.findOne({ id: launch.userId, active: true }));
    if (!user) throw fail(401, "קישור ההפעלה פג תוקף");
    res.json(await sessionFor(user, res, config.authMode));
  });
  app.post("/api/auth/login", limiter, (req, res) => {
    throw fail(
      403,
      "המערכת משתמשת בהזדהות ארגונית ללא סיסמה. בסביבת הבדיקה יש לבחור משתמש.",
    );
  });
  app.post("/api/auth/logout", async (req, res) => {
    const raw = bearer(req) || rawCookie(req);
    if (raw) await sessions.deleteOne({ _id: hash(raw) });
    res
      .clearCookie("readiness_session", { path: config.apiPrefix || "/" })
      .json({ ok: true });
  });
  app.use("/api", async (req, res, next) => {
    req.user = await currentUser(req);
    if (!req.user)
      throw fail(
        401,
        "המשתמש אינו מורשה. נדרש זיהוי ארגוני ושיוך ידני במערכת.",
      );
    req.testMode = testMode;
    next();
  });
  return { testMode };
}
exports.installAuth = installAuth;
