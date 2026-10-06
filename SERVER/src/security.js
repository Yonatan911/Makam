"use strict";
const {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} = require("node:crypto");
const { hasRoomAccess, canEditRoom } = require("../shared/model.js");
const token = () => randomBytes(32).toString("hex");
const hash = (value) => createHash("sha256").update(value).digest("hex");
function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function verifyPassword(password, value) {
  try {
    const [salt, key] = value.split(":");
    return timingSafeEqual(
      Buffer.from(key, "hex"),
      scryptSync(password, salt, 64),
    );
  } catch {
    return false;
  }
}
const safeEqual = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const safeUser = ({ _id, passwordHash, rank, ...user }) => user;
const canRead = hasRoomAccess;
const canWrite = canEditRoom;
function normalizeWindowsIdentity(value, domain) {
  if (typeof value !== "string" || !domain) return null;
  const match = /^([^\\]+)\\([a-zA-Z0-9][a-zA-Z0-9._-]{0,63})$/.exec(value);
  return match && match[1].toLowerCase() === domain.toLowerCase()
    ? match[2].toLowerCase()
    : null;
}

exports.token = token;
exports.hash = hash;
exports.passwordHash = passwordHash;
exports.verifyPassword = verifyPassword;
exports.safeEqual = safeEqual;
exports.safeUser = safeUser;
exports.canRead = canRead;
exports.canWrite = canWrite;
exports.normalizeWindowsIdentity = normalizeWindowsIdentity;
