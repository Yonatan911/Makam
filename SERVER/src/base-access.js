"use strict";
const globalAccess = (user) => ["owner", "command_admin"].includes(user?.role);
function grantFor(user, baseId) {
  if (user?.baseGrants?.[baseId]) return user.baseGrants[baseId];
  if (!(user?.baseIds || []).includes(baseId)) return null;
  return {
    role: user.role,
    roomIds: user.roomIds || [],
    allRooms: user.allRooms === true,
    active: user.active !== false,
    version: 0,
  };
}
const canAccessBase = (user, baseId) =>
  globalAccess(user) || grantFor(user, baseId)?.active === true;
const managesBase = (user, baseId) =>
  globalAccess(user) ||
  (canAccessBase(user, baseId) && grantFor(user, baseId)?.role === "admin");
const managesAnyBase = (user) =>
  globalAccess(user) ||
  (user.baseIds || []).some((id) => managesBase(user, id));
function userInBase(user, baseId) {
  const grant = grantFor(user, baseId);
  const { baseGrants, ...identity } = user;
  if (globalAccess(user)) return identity;
  return {
    ...identity,
    ...grant,
    id: user.id,
    username: user.username,
    name: grant?.name || user.name,
    email: grant?.email ?? user.email,
    active: user.active !== false && grant?.active === true,
    baseIds: [baseId],
    version: grant?.version || 0,
  };
}

// Match against effective per-base roles before applying callers' filters
// (assignees, technician exports, mail recipients). Do not filter on legacy roles.
function userPipeline(baseId, query = {}) {
  const field = "$baseGrants." + baseId;
  const global = { $in: ["$role", ["owner", "command_admin"]] };
  const fallback = (key, value) => ({ $ifNull: [field + "." + key, value] });
  return [
    {
      $match: {
        $or: [
          { role: { $in: ["owner", "command_admin"] } },
          { baseIds: baseId },
        ],
      },
    },
    {
      $set: {
        role: { $cond: [global, "$role", fallback("role", "$role")] },
        roomIds: {
          $cond: [
            global,
            [],
            fallback("roomIds", { $ifNull: ["$roomIds", []] }),
          ],
        },
        allRooms: {
          $cond: [
            global,
            true,
            fallback("allRooms", { $ifNull: ["$allRooms", false] }),
          ],
        },
        active: {
          $and: [
            "$active",
            { $cond: [global, true, fallback("active", true)] },
          ],
        },
        name: { $cond: [global, "$name", fallback("name", "$name")] },
        email: { $cond: [global, "$email", fallback("email", "$email")] },
      },
    },
    { $unset: "baseGrants" },
    { $match: query },
  ];
}

exports.globalAccess = globalAccess;
exports.grantFor = grantFor;
exports.canAccessBase = canAccessBase;
exports.managesBase = managesBase;
exports.managesAnyBase = managesAnyBase;
exports.userInBase = userInBase;
exports.userPipeline = userPipeline;
