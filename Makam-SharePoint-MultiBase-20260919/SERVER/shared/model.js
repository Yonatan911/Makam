var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var stdin_exports = {};
__export(stdin_exports, {
  ACTIVE: () => ACTIVE,
  CATEGORIES: () => CATEGORIES,
  DEFAULT_SCORING: () => DEFAULT_SCORING,
  KINDS: () => KINDS,
  REQUEST_STATUSES: () => REQUEST_STATUSES,
  ROLES: () => ROLES,
  ROOM_TYPES: () => ROOM_TYPES,
  STATUSES: () => STATUSES,
  TRANSITIONS: () => TRANSITIONS,
  WEEKDAYS: () => WEEKDAYS,
  activeAssets: () => activeAssets,
  aggregate: () => aggregate,
  assetProfile: () => assetProfile,
  canEditRoom: () => canEditRoom,
  dependencyIds: () => dependencyIds,
  effectiveAsset: () => effectiveAsset,
  freshness: () => freshness,
  hasRoomAccess: () => hasRoomAccess,
  isManager: () => isManager,
  israelTime: () => israelTime,
  localParts: () => localParts,
  publicRoom: () => publicRoom,
  readiness: () => readiness,
  readinessBand: () => readinessBand,
  scheduleState: () => scheduleState,
  sortRooms: () => sortRooms,
  weight: () => weight
});
module.exports = __toCommonJS(stdin_exports);
const CATEGORIES = {
  computing: "\u05DE\u05D7\u05E9\u05D5\u05D1",
  telephony: "\u05D8\u05DC\u05E4\u05D5\u05E0\u05D9\u05D4",
  display: "\u05EA\u05E6\u05D5\u05D2\u05D4",
  power: "\u05D2\u05D9\u05D1\u05D5\u05D9 \u05D7\u05E9\u05DE\u05DC"
};
const STATUSES = {
  healthy: "\u05EA\u05E7\u05D9\u05DF",
  faulty: "\u05EA\u05E7\u05D5\u05DC",
  in_progress: "\u05D1\u05D8\u05D9\u05E4\u05D5\u05DC",
  waiting: "\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D7\u05DC\u05E4\u05D9\u05DD \u05D0\u05D5 \u05DC\u05D2\u05D5\u05E8\u05DD \u05D7\u05D5\u05E5",
  repaired: "\u05EA\u05D5\u05E7\u05DF, \u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05DE\u05D5\u05EA",
  closed: "\u05E0\u05E1\u05D2\u05E8",
  maintenance: "\u05EA\u05D7\u05D6\u05D5\u05E7\u05D4 \u05DE\u05EA\u05D5\u05DB\u05E0\u05E0\u05EA"
};
const ROLES = {
  owner: "\u05D1\u05E2\u05DC\u05D9\u05DD",
  admin: "\u05DE\u05E0\u05D4\u05DC \u05DE\u05E2\u05E8\u05DB\u05EA",
  command_admin: "\u05DE\u05E0\u05D4\u05DC \u05DE\u05E2\u05E8\u05DB\u05EA \u05E4\u05D9\u05E7\u05D5\u05D3\u05D9",
  technician: "\u05D8\u05DB\u05E0\u05D0\u05D9",
  commander: "\u05DE\u05E4\u05E7\u05D3 \u05DE\u05E8\u05D7\u05D1",
  viewer: "\u05E0\u05E6\u05D9\u05D2 \u05DE\u05E8\u05D7\u05D1"
};
const ROOM_TYPES = ["\u05D7\u05DE\u05F4\u05DC", "\u05D7\u05D3\u05F4\u05DF"];
const KINDS = {
  computer: "\u05DE\u05D7\u05E9\u05D1",
  server: "\u05E9\u05E8\u05EA",
  switch: "\u05DE\u05EA\u05D2 \u05EA\u05E7\u05E9\u05D5\u05E8\u05EA",
  router: "\u05E0\u05EA\u05D1",
  phone: "\u05D8\u05DC\u05E4\u05D5\u05DF",
  screen: "\u05DE\u05E1\u05DA",
  matrix: "\u05DE\u05D8\u05E8\u05D9\u05E6\u05EA \u05EA\u05E6\u05D5\u05D2\u05D4",
  projector: "\u05DE\u05E7\u05E8\u05DF",
  ups: "\u05D0\u05DC\u05BE\u05E4\u05E1\u05E7 (UPS)",
  power: "\u05DC\u05D5\u05D7 \u05D7\u05E9\u05DE\u05DC",
  printer: "\u05DE\u05D3\u05E4\u05E1\u05EA",
  radio: "\u05DE\u05DB\u05E9\u05D9\u05E8 \u05E7\u05E9\u05E8",
  camera: "\u05DE\u05E6\u05DC\u05DE\u05D4",
  other: "\u05D0\u05DE\u05E6\u05E2\u05D9 \u05D0\u05D7\u05E8"
};
const REQUEST_STATUSES = {
  pending: "\u05DE\u05DE\u05EA\u05D9\u05E0\u05D4 \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8",
  approved: "\u05D0\u05D5\u05E9\u05E8\u05D4 \u2014 \u05E0\u05D3\u05E8\u05E9\u05EA \u05D1\u05D3\u05D9\u05E7\u05D4",
  rejected: "\u05DC\u05D0 \u05D0\u05D5\u05E9\u05E8\u05D4",
  completed: "\u05D4\u05D1\u05D3\u05D9\u05E7\u05D4 \u05D4\u05D5\u05E9\u05DC\u05DE\u05D4",
  cancelled: "\u05D1\u05D5\u05D8\u05DC\u05D4"
};
const WEEKDAYS = [
  "\u05E8\u05D0\u05E9\u05D5\u05DF",
  "\u05E9\u05E0\u05D9",
  "\u05E9\u05DC\u05D9\u05E9\u05D9",
  "\u05E8\u05D1\u05D9\u05E2\u05D9",
  "\u05D7\u05DE\u05D9\u05E9\u05D9",
  "\u05E9\u05D9\u05E9\u05D9",
  "\u05E9\u05D1\u05EA"
];
const ACTIVE = ["faulty", "in_progress", "waiting", "repaired"];
const TRANSITIONS = {
  healthy: ["faulty", "maintenance"],
  faulty: ["in_progress", "waiting", "repaired"],
  in_progress: ["waiting", "repaired"],
  waiting: ["in_progress", "repaired"],
  repaired: ["closed", "faulty"],
  closed: ["faulty", "maintenance"],
  maintenance: ["healthy", "faulty"]
};
const DEFAULT_SCORING = {
  critical: 3,
  regular: 1,
  low: 0.25,
  medium: 0.6,
  high: 1
};
const isManager = (user) => ["owner", "command_admin", "admin"].includes(user?.role);
const readinessBand = (score) => score == null ? "unknown" : score > 90 ? "green" : score >= 70 ? "orange" : "red";
function sortRooms(rooms, order = "name") {
  const byName = (a, b) => a.name.localeCompare(b.name, "he");
  return [...rooms].sort((a, b) => {
    if (order === "name") return byName(a, b);
    if (order === "check-oldest" || order === "check-newest") {
      const first = a.lastCheck?.at ? Date.parse(a.lastCheck.at) : 0;
      const second = b.lastCheck?.at ? Date.parse(b.lastCheck.at) : 0;
      return (order === "check-newest" ? second - first : first - second) || byName(a, b);
    }
    const x = a.metrics.overall.score, y = b.metrics.overall.score;
    if (x == null || y == null)
      return (x == null ? 1 : 0) - (y == null ? 1 : 0) || byName(a, b);
    return (order === "score-high" ? y - x : x - y) || byName(a, b);
  });
}
const hasRoomAccess = (user, roomId) => isManager(user) || user?.allRooms === true || (user?.roomIds || []).includes(roomId);
const canEditRoom = (user, roomId) => isManager(user) || user?.role === "technician" && hasRoomAccess(user, roomId);
const dependencyIds = (asset) => asset.parentIds ?? (asset.dependency === "hard" && asset.parentId ? [asset.parentId] : []);
const activeAssets = (room) => (room.assets || []).filter((a) => !a.archived);
const weight = (a, settings = {}) => a.critical ? settings.scoring?.critical || 3 : settings.scoring?.regular || 1;
function assetProfile(kind) {
  const computer = ["computer", "server"].includes(kind), network = [
    "computer",
    "server",
    "switch",
    "router",
    "printer",
    "camera"
  ].includes(kind);
  return {
    nameLabel: computer ? "\u05E9\u05DD \u05DE\u05D7\u05E9\u05D1" : kind === "phone" ? "\u05E9\u05DD \u05D8\u05DC\u05E4\u05D5\u05DF" : "\u05E9\u05DD \u05D0\u05DE\u05E6\u05E2\u05D9",
    ip: network,
    network: network || ["phone", "radio"].includes(kind),
    phone: kind === "phone",
    serial: true,
    defaultCategory: kind === "ups" || kind === "power" ? "power" : ["phone", "radio"].includes(kind) ? "telephony" : ["screen", "matrix", "projector"].includes(kind) ? "display" : "computing"
  };
}
function effectiveAsset(asset, assets, visited = /* @__PURE__ */ new Set(), settings = {}) {
  if (visited.has(asset.id) || asset.archived)
    return { loss: 0, causes: [], causeIds: [], planned: !!asset.archived };
  const next = new Set(visited).add(asset.id);
  if (asset.status === "maintenance")
    return { loss: 0, causes: [], causeIds: [], planned: true };
  const upstream = dependencyIds(asset).map((id) => assets.find((p) => !p.archived && p.id === id)).filter(Boolean).map((parent) => effectiveAsset(parent, assets, next, settings));
  if (upstream.some((p) => p.planned))
    return { loss: 0, causes: [], causeIds: [], planned: true };
  const own = ACTIVE.includes(asset.status) ? settings.scoring?.[asset.severity] ?? DEFAULT_SCORING[asset.severity] ?? 1 : 0;
  return {
    loss: Math.max(own, ...upstream.map((p) => p.loss)),
    causes: [
      .../* @__PURE__ */ new Set([
        ...own ? [asset.name] : [],
        ...upstream.flatMap((p) => p.causes)
      ])
    ],
    causeIds: [
      .../* @__PURE__ */ new Set([
        ...own ? [asset.id] : [],
        ...upstream.flatMap((p) => p.causeIds)
      ])
    ],
    planned: false
  };
}
function readiness(room, settings = {}) {
  const source = activeAssets(room), all = source.map((a) => ({
    ...a,
    ...effectiveAsset(a, source, /* @__PURE__ */ new Set(), settings)
  }));
  const calc = (list) => {
    const eligible = room.maintenance ? [] : list.filter((a) => !a.planned), totalWeight = eligible.reduce((n, a) => n + weight(a, settings), 0), lossWeight = eligible.reduce(
      (n, a) => n + weight(a, settings) * a.loss,
      0
    ), score = totalWeight ? Math.round(100 * (1 - lossWeight / totalWeight)) : null;
    const deductions = eligible.filter((a) => a.loss > 0).map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      weight: weight(a, settings),
      severity: a.severity,
      impact: a.loss,
      points: Math.round(weight(a, settings) * a.loss / totalWeight * 1e3) / 10,
      causes: a.causes,
      inherited: !ACTIVE.includes(a.status),
      note: a.note || ""
    }));
    return {
      score,
      totalWeight,
      lossWeight,
      assetCount: eligible.length,
      excludedCount: list.length - eligible.length,
      deductions,
      scoring: settings.scoring || DEFAULT_SCORING,
      explanation: room.maintenance ? "\u05D4\u05DE\u05E8\u05D7\u05D1 \u05E0\u05DE\u05E6\u05D0 \u05D1\u05D4\u05E9\u05D1\u05EA\u05D4 \u05DE\u05EA\u05D5\u05DB\u05E0\u05E0\u05EA \u05D5\u05D0\u05D9\u05E0\u05D5 \u05E0\u05DB\u05DC\u05DC \u05D1\u05D7\u05D9\u05E9\u05D5\u05D1" : !totalWeight ? "\u05D0\u05D9\u05DF \u05D0\u05DE\u05E6\u05E2\u05D9\u05DD \u05D1\u05EA\u05D7\u05D5\u05DD \u05D6\u05D4; \u05D4\u05D5\u05D0 \u05D0\u05D9\u05E0\u05D5 \u05DE\u05E9\u05E4\u05D9\u05E2 \u05E2\u05DC \u05D4\u05E6\u05D9\u05D5\u05DF" : deductions.length ? deductions.map(
        (d) => `${d.name}: ${d.points} \u05E0\u05E7\u05D5\u05D3\u05D5\u05EA \u05E2\u05E7\u05D1 ${d.causes.join(", ")}`
      ).join("\n") : "\u05DB\u05DC \u05D4\u05D0\u05DE\u05E6\u05E2\u05D9\u05DD \u05D1\u05EA\u05D7\u05D5\u05DD \u05EA\u05E7\u05D9\u05E0\u05D9\u05DD"
    };
  };
  return {
    overall: calc(all),
    categories: Object.fromEntries(
      Object.keys(CATEGORIES).map((c) => [
        c,
        calc(all.filter((a) => a.category === c))
      ])
    ),
    planned: room.maintenance ? all.length : all.filter((a) => a.planned).length,
    impacted: room.maintenance ? 0 : all.filter((a) => a.loss > 0 && !a.planned).length,
    warning: !room.maintenance && all.some((a) => a.kind === "ups" && a.loss > 0 && !a.planned),
    hasUps: all.some((a) => a.kind === "ups"),
    assets: all
  };
}
function localParts(now = Date.now()) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(now)).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)])
  );
}
function israelTime(year, month, day, hour = 0, minute = 0) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let value = wall;
  for (let i = 0; i < 3; i++) {
    const p = localParts(value);
    const rendered = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    value += wall - rendered;
  }
  return value;
}
function scheduleState(room, settings, now = Date.now()) {
  const schedule = room.scheduleOverride || settings.schedule;
  if (!schedule?.enabled || room.maintenance)
    return { enabled: false, overdue: false };
  const p = localParts(now), day = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(), delta = (day - schedule.day + 7) % 7, cycleDate = new Date(Date.UTC(p.year, p.month - 1, p.day - delta)), [h, m] = (schedule.time || "17:00").split(":").map(Number);
  const start = israelTime(
    cycleDate.getUTCFullYear(),
    cycleDate.getUTCMonth() + 1,
    cycleDate.getUTCDate()
  ), due = israelTime(
    cycleDate.getUTCFullYear(),
    cycleDate.getUTCMonth() + 1,
    cycleDate.getUTCDate(),
    h,
    m
  ), nextDate = new Date(cycleDate.getTime() + 7 * 864e5), nextDue = israelTime(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth() + 1,
    nextDate.getUTCDate(),
    h,
    m
  ), completed = !!room.lastCheck && new Date(room.lastCheck.at).getTime() >= start;
  return {
    enabled: true,
    day: schedule.day,
    time: schedule.time,
    cycleStart: new Date(start).toISOString(),
    dueAt: new Date(due).toISOString(),
    nextDueAt: new Date(completed ? nextDue : due).toISOString(),
    completed,
    overdue: !completed && now > due
  };
}
function freshness(room, settings, now = Date.now()) {
  if (room.maintenance) return "planned";
  if ((room.requests || []).some((r) => r.status === "approved"))
    return "expired";
  const time = room.lastCheck ? new Date(room.lastCheck.at).getTime() : 0;
  if (!time || settings.round?.roomIds?.includes(room.id) && room.lastCheck?.roundId !== settings.round.id || scheduleState(room, settings, now).overdue)
    return "expired";
  const ratio = (now - time) / ((settings.freshnessDays || 7) * 864e5);
  return ratio >= 1 ? "expired" : ratio >= 0.75 ? "aging" : "fresh";
}
function aggregate(rooms, explain = false, settings = {}) {
  const calculated = rooms.map((r) => readiness(r, settings));
  const metric = (key) => {
    const list = calculated.map((c) => key ? c.categories[key] : c.overall), totalWeight = list.reduce((n, c) => n + c.totalWeight, 0), lossWeight = list.reduce((n, c) => n + c.lossWeight, 0), score = totalWeight ? Math.round(100 * (1 - lossWeight / totalWeight)) : null;
    const deductions = list.flatMap(
      (c, i) => c.deductions.map((d) => ({
        ...d,
        roomName: rooms[i].name,
        name: rooms[i].name + " / " + d.name,
        points: totalWeight ? Math.round(d.weight * d.impact / totalWeight * 1e3) / 10 : 0
      }))
    );
    return {
      score,
      totalWeight,
      lossWeight,
      deductions,
      assetCount: list.reduce((n, c) => n + c.assetCount, 0),
      excludedCount: list.reduce((n, c) => n + c.excludedCount, 0),
      scoring: settings.scoring || DEFAULT_SCORING,
      explanation: totalWeight ? deductions.length ? deductions.map((d) => `${d.name}: \u05D9\u05E8\u05D9\u05D3\u05D4 \u05E9\u05DC ${d.points} \u05E0\u05E7\u05D5\u05D3\u05D5\u05EA`).join("\n") : "\u05DB\u05DC \u05D4\u05D0\u05DE\u05E6\u05E2\u05D9\u05DD \u05D4\u05E0\u05DB\u05DC\u05DC\u05D9\u05DD \u05D1\u05D7\u05D9\u05E9\u05D5\u05D1 \u05EA\u05E7\u05D9\u05E0\u05D9\u05DD" : "\u05D0\u05D9\u05DF \u05D0\u05DE\u05E6\u05E2\u05D9\u05DD \u05D4\u05E0\u05DB\u05DC\u05DC\u05D9\u05DD \u05D1\u05D7\u05D9\u05E9\u05D5\u05D1"
    };
  };
  const overallMetric = metric(), categoryMetrics = Object.fromEntries(
    Object.keys(CATEGORIES).map((k) => [k, metric(k)])
  );
  return {
    overall: overallMetric.score,
    categories: Object.fromEntries(
      Object.entries(categoryMetrics).map(([k, v]) => [k, v.score])
    ),
    ...explain ? { overallMetric, categoryMetrics } : {}
  };
}
function publicRoom(room, user, settings) {
  const manager = isManager(user), commander = user.role === "commander", viewer = user.role === "viewer";
  const active = activeAssets(room).map(({ checkedBy, checkedById, ...a }) => ({
    ...a,
    ...manager || commander ? { checkedBy, checkedById } : {}
  }));
  const metrics = readiness({ ...room, assets: active }, settings);
  const result = {
    id: room.id,
    name: room.name,
    type: room.type,
    note: room.note || "",
    maintenance: room.maintenance,
    version: room.version,
    demo: !!room.demo,
    assets: active,
    metrics,
    freshness: freshness(room, settings),
    schedule: scheduleState(room, settings),
    scheduleOverride: room.scheduleOverride || null,
    plan: room.plan,
    lastCheck: room.lastCheck ? manager || commander ? room.lastCheck : { at: room.lastCheck.at, roundId: room.lastCheck.roundId } : null,
    lastPartialCheck: room.lastPartialCheck ? manager || commander ? room.lastPartialCheck : { at: room.lastPartialCheck.at } : null
  };
  if (manager) {
    result.archivedAssets = (room.assets || []).filter((a) => a.archived);
    result.audit = room.audit || [];
    result.faults = room.faults || [];
    result.requests = room.requests || [];
  } else if (commander) {
    result.faults = (room.faults || []).map(({ history, ...f }) => f);
    result.requests = (room.requests || []).map(({ mailEvents, ...r }) => r);
    result.checks = (room.audit || []).filter(
      (a) => a.action === "\u05D1\u05D3\u05D9\u05E7\u05EA \u05DB\u05E9\u05D9\u05E8\u05D5\u05EA" || a.action === "\u05D1\u05D3\u05D9\u05E7\u05D4 \u05DE\u05DE\u05D5\u05E7\u05D3\u05EA"
    );
  } else if (!viewer) {
    result.faults = (room.faults || []).filter((f) => f.status !== "closed").map(
      ({
        history,
        openedBy,
        openedById,
        openedAt,
        closedBy,
        closedById,
        ...f
      }) => f
    );
    result.requests = (room.requests || []).filter((r) => r.status === "approved").map(({ requestedById, history, ...r }) => r);
  } else {
    result.faults = (room.faults || []).filter((f) => f.status !== "closed").map(({ id, assetId, status, description, severity }) => ({
      id,
      assetId,
      status,
      description,
      severity
    }));
    result.requests = [];
  }
  return result;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ACTIVE,
  CATEGORIES,
  DEFAULT_SCORING,
  KINDS,
  REQUEST_STATUSES,
  ROLES,
  ROOM_TYPES,
  STATUSES,
  TRANSITIONS,
  WEEKDAYS,
  activeAssets,
  aggregate,
  assetProfile,
  canEditRoom,
  dependencyIds,
  effectiveAsset,
  freshness,
  hasRoomAccess,
  isManager,
  israelTime,
  localParts,
  publicRoom,
  readiness,
  readinessBand,
  scheduleState,
  sortRooms,
  weight
});
