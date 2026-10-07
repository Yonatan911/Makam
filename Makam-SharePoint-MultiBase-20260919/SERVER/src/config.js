"use strict";
const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");

function parseListenTarget(value, fallback = 4310) {
  if (value === undefined || value === "") return fallback;
  if (/^\\\\\.\\pipe\\[^\r\n]+$/.test(value)) return value;
  if (!/^\d+$/.test(String(value)))
    throw new Error("PORT must be a TCP port or an IISNode named pipe");
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("PORT is out of range");
  return port;
}
function absoluteUrl(value, name, production) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  if (
    !["https:", ...(production ? [] : ["http:"])].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    /%|\/\//.test(url.pathname)
  )
    throw new Error(
      `${name} must be a clean ${production ? "HTTPS" : "HTTP(S)"} URL`,
    );
  return url;
}
function loadConfiguration({
  root = path.resolve(__dirname, ".."),
  env = process.env,
  purpose = "runtime",
} = {}) {
  // Never override PORT or another host-provided value, including an explicit empty value.
  const file = path.join(root, ".env");
  const values = {
    ...(fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {}),
    ...env,
  };
  const nodeEnv =
    values.NODE_ENV ||
    (/^\\\\\.\\pipe\\/.test(values.PORT || "") ? "production" : "development");
  const production = nodeEnv === "production";
  if (!["development", "test", "production"].includes(nodeEnv))
    throw new Error("Invalid NODE_ENV");
  const required = production
    ? [
        "AUTH_MODE",
        "MONGODB_URI",
        "MONGODB_DATABASE",
        "PUBLIC_API_URL",
        "APP_PUBLIC_URL",
        "SHAREPOINT_ORIGIN",
        "AD_DOMAIN",
      ]
    : [];
  const missing = required.filter((k) => !values[k]);
  if (missing.length)
    throw new Error("Missing production configuration: " + missing.join(", "));
  const authMode = values.AUTH_MODE || "local";
  if (
    ![
      "local",
      "local-test",
      "iis-session",
      "windows-proxy",
      "sharepoint-library",
    ].includes(authMode)
  )
    throw new Error("Invalid AUTH_MODE");
  if (production && authMode !== "iis-session")
    throw new Error("Production requires AUTH_MODE=iis-session");
  if (
    production &&
    purpose !== "migration" &&
    values.TRUSTED_IDENTITY_VERIFIED !== "true"
  )
    throw new Error(
      "DevOps must verify Windows Authentication and native IISNode identity promotion before enabling TRUSTED_IDENTITY_VERIFIED=true",
    );
  if (
    production &&
    (values.ENABLE_LOCAL_TEST_LOGIN === "true" ||
      values.AUTO_INITIALIZE_TEST_DB === "true")
  )
    throw new Error("Production cannot initialize demo data or test accounts");
  if (
    authMode === "local-test" &&
    (values.ENABLE_LOCAL_TEST_LOGIN !== "true" || production)
  )
    throw new Error("Local test login requires explicit development opt-in");
  const mongoUri = values.MONGODB_URI || "mongodb://127.0.0.1:27028";
  const database = values.MONGODB_DATABASE || "command_readiness_dev";
  if (!/^mongodb(?:\+srv)?:\/\//.test(mongoUri))
    throw new Error("Invalid MONGODB_URI");
  if (
    !/^[a-zA-Z0-9_-]{1,63}$/.test(database) ||
    ["admin", "local", "config"].includes(database)
  )
    throw new Error("Explicit isolated application database name required");
  const target = parseListenTarget(values.PORT);
  const numericPort = typeof target === "number" ? target : null;
  const api = absoluteUrl(
    values.PUBLIC_API_URL ||
      (values.APP_ORIGIN || `http://127.0.0.1:${numericPort || 4310}`) + "/api",
    "PUBLIC_API_URL",
    production,
  );
  api.pathname = api.pathname.replace(/\/+$/, "");
  if (!api.pathname.endsWith("/api"))
    throw new Error("PUBLIC_API_URL must include and end with /api");
  const publicUrl = absoluteUrl(
    values.APP_PUBLIC_URL || api.origin,
    "APP_PUBLIC_URL",
    production,
  );
  if (
    production &&
    [api, publicUrl].some((u) =>
      ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname),
    )
  )
    throw new Error("Production public URLs cannot use localhost");
  const sharepoint = values.SHAREPOINT_ORIGIN
    ? absoluteUrl(values.SHAREPOINT_ORIGIN, "SHAREPOINT_ORIGIN", production)
    : null;
  if (sharepoint && sharepoint.pathname !== "/")
    throw new Error("SHAREPOINT_ORIGIN must contain an origin only");
  const allowedOrigins = [
    ...new Set([
      api.origin,
      sharepoint?.origin,
      ...(production ? [] : ["http://127.0.0.1:5173"]),
      ...String(values.CORS_ORIGINS || "")
        .split(",")
        .filter(Boolean)
        .map((x) => {
          const u = absoluteUrl(x.trim(), "CORS_ORIGINS", production);
          if (u.pathname !== "/")
            throw new Error("CORS_ORIGINS must contain origins");
          return u.origin;
        }),
    ]),
  ].filter(Boolean);
  if (
    values.BOOTSTRAP_OWNER_SAM &&
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(values.BOOTSTRAP_OWNER_SAM)
  )
    throw new Error("Invalid BOOTSTRAP_OWNER_SAM");
  if (
    values.BOOTSTRAP_ADMIN_SAM &&
    (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(values.BOOTSTRAP_ADMIN_SAM) ||
      values.BOOTSTRAP_ADMIN_SAM.toLowerCase() ===
        values.BOOTSTRAP_OWNER_SAM?.toLowerCase())
  )
    throw new Error("Invalid BOOTSTRAP_ADMIN_SAM");
  if (values.LDAP_URL && !values.LDAP_URL.startsWith("ldaps://"))
    throw new Error("LDAP_URL must use LDAPS");
  const host = values.HOST || "127.0.0.1";
  if (numericPort !== null && !["127.0.0.1", "::1", "localhost"].includes(host))
    throw new Error("Local TCP binding must use loopback");
  const smtpPort = Number(values.SMTP_PORT || 587);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)
    throw new Error("Invalid SMTP_PORT");
  return Object.freeze({
    root,
    nodeEnv,
    production,
    authMode,
    listenTarget: target,
    host,
    origin: api.origin,
    apiBaseUrl: api.href.replace(/\/$/, ""),
    apiPrefix: api.pathname.slice(0, -4),
    publicUrl: publicUrl.href,
    allowedOrigins,
    mongoUri,
    database,
    cookieSecure: production || values.COOKIE_SECURE === "true",
    adDomain: values.AD_DOMAIN || "",
    trustedIdentityVerified: values.TRUSTED_IDENTITY_VERIFIED === "true",
    sessionHours: 8,
    jobsEnabled: values.JOBS_ENABLED === "true",
    initializeTest:
      nodeEnv === "test" && values.AUTO_INITIALIZE_TEST_DB === "true",
    values: Object.freeze(values),
  });
}
exports.loadConfiguration = loadConfiguration;
exports.parseListenTarget = parseListenTarget;
