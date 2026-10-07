"use strict";
const { Client } = require("ldapts");
const { z } = require("zod");
const escapeLdap = (value) =>
  value.replace(
    /[\\*()\0]/g,
    (c) => "\\" + c.charCodeAt(0).toString(16).padStart(2, "0"),
  );
const attempts = new Map();
// Identity and role are already validated before this optional profile-only sync.
// Directory groups never create users or grant privileges.
async function syncAdProfile(user, users) {
  if (
    !user ||
    !process.env.LDAP_URL ||
    !process.env.LDAP_BIND_DN ||
    !process.env.LDAP_BIND_PASSWORD ||
    !process.env.LDAP_BASE_DN
  )
    return user;
  if (Date.now() - (attempts.get(user.id) || 0) < 3600000) return user;
  if (
    user.adRefreshedAt &&
    Date.now() - new Date(user.adRefreshedAt) < 86400000
  )
    return user;
  attempts.set(user.id, Date.now());
  if (!process.env.LDAP_URL.startsWith("ldaps://")) {
    console.error("AD profile sync requires LDAPS.");
    return user;
  }
  const ldap = new Client({
    url: process.env.LDAP_URL,
    timeout: 5000,
    connectTimeout: 5000,
    tlsOptions: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  });
  try {
    await ldap.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_PASSWORD);
    const account = user.username.includes("\\")
      ? user.username.split("\\").pop()
      : user.username;
    const attribute = account.includes("@")
      ? "userPrincipalName"
      : "sAMAccountName";
    const { searchEntries } = await ldap.search(process.env.LDAP_BASE_DN, {
      scope: "sub",
      filter: `(&(objectClass=user)(${attribute}=${escapeLdap(account)}))`,
      attributes: ["displayName", "mail"],
      sizeLimit: 2,
    });
    if (searchEntries.length !== 1) return user;
    const entry = searchEntries[0],
      patch = { adRefreshedAt: new Date().toISOString() };
    if (typeof entry.displayName === "string" && entry.displayName.trim())
      patch.name = entry.displayName.trim().slice(0, 100);
    if (
      typeof entry.mail === "string" &&
      z.email().safeParse(entry.mail.trim()).success
    )
      patch.email = entry.mail.trim();
    await users.updateOne({ id: user.id, active: true }, { $set: patch });
    return { ...user, ...patch };
  } catch {
    console.error(
      "AD profile sync unavailable; keeping the existing manually assigned profile.",
    );
    return user;
  } finally {
    await ldap.unbind().catch(() => {});
  }
}

exports.escapeLdap = escapeLdap;
exports.syncAdProfile = syncAdProfile;
