"use strict";
const { z } = require("zod");
const { isIP } = require("node:net");
const {
  KINDS,
  CATEGORIES,
  assetProfile,
  activeAssets,
  dependencyIds,
} = require("../shared/model.js");
const fail = (status, message) => Object.assign(new Error(message), { status });
const parse = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success)
    throw fail(
      400,
      "יש לבדוק את שדות החובה, הבחירות, המספרים והתאריכים בטופס.",
    );
  return result.data;
};
const id = z.string().uuid(),
  short = z.string().trim().min(1).max(120),
  note = z.string().trim().min(3).max(2000),
  timestamp = z.iso.datetime();
const scheduleSchema = z.object({
  enabled: z.boolean(),
  day: z.number().int().min(0).max(6),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
const assetSchema = z.object({
  name: short,
  kind: z.enum(Object.keys(KINDS)),
  category: z.enum(Object.keys(CATEGORIES)),
  critical: z.boolean().default(false),
  network: z.string().trim().max(80).default(""),
  ip: z.string().trim().max(100).default(""),
  phone: z.string().trim().max(80).default(""),
  serial: z.string().trim().max(120).default(""),
  parentId: id.nullable().default(null),
  parentIds: z.array(id).max(249).optional(),
  dependentIds: z.array(id).max(249).optional(),
  dependency: z.enum(["none", "hard", "redundancy"]).default("none"),
  backupIds: z.array(id).max(20).default([]),
  x: z.number().min(2).max(98).default(50),
  y: z.number().min(2).max(98).default(50),
  rotation: z.number().min(0).max(360).default(0),
});
function cleanAsset(a) {
  const { dependentIds, ...stored } = a;
  const p = assetProfile(a.kind);
  if (p.ip && a.ip && !isIP(a.ip)) throw fail(400, "כתובת ה־IP אינה תקינה");
  return {
    ...stored,
    ip: p.ip ? a.ip : "",
    phone: p.phone ? a.phone : "",
    network: p.network ? a.network : "",
    parentIds:
      a.dependency === "redundancy" ? [] : [...new Set(dependencyIds(a))],
    parentId: null,
    dependency:
      a.dependency !== "redundancy" && dependencyIds(a).length
        ? "hard"
        : "none",
    ...(a.dependency === "redundancy"
      ? {
          backupIds: [
            ...new Set([...a.backupIds, ...(a.parentId ? [a.parentId] : [])]),
          ],
          parentId: null,
          dependency: "none",
        }
      : {}),
  };
}
function applyDependents(room, parent, ids) {
  if (ids === undefined) return;
  const assets = activeAssets(room);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => id === parent.id || !assets.some((a) => a.id === id))
  )
    throw fail(400, "יש לבחור אמצעים פעילים מאותו מרחב, ללא האמצעי המזין עצמו");
  if (parent.kind === "ups" && ids.length)
    throw fail(400, "אל־פסק משויך כגיבוי ואינו יוצר תלות משביתה");
  for (const child of assets) {
    const parents = dependencyIds(child).filter((id) => id !== parent.id);
    if (ids.includes(child.id)) parents.push(parent.id);
    child.parentIds = parents;
    child.parentId = null;
    child.dependency = parents.length ? "hard" : "none";
  }
}
function validateDependencies(room) {
  const assets = activeAssets(room);
  for (const a of assets) {
    for (const parentId of dependencyIds(a)) {
      const p = assets.find((p) => p.id === parentId);
      if (!p || p.kind === "ups")
        throw fail(
          400,
          "יש לבחור רכיב מזין מהמלאי הפעיל. אל־פסק יש לשייך בשדה הגיבוי",
        );
    }
    for (const bid of a.backupIds || []) {
      if (bid === a.id || !assets.some((b) => b.id === bid && b.kind === "ups"))
        throw fail(400, "יש לבחור יחידת אל־פסק פעילה לגיבוי");
    }
  }
  const visiting = new Set(),
    complete = new Set();
  const visit = (a) => {
    if (visiting.has(a.id))
      throw fail(400, "לא ניתן ליצור מעגל תלות בין אמצעים");
    if (complete.has(a.id)) return;
    visiting.add(a.id);
    for (const pid of dependencyIds(a)) visit(assets.find((p) => p.id === pid));
    visiting.delete(a.id);
    complete.add(a.id);
  };
  assets.forEach(visit);
}
const planSchema = z.object({
  width: z.number().min(400).max(2400),
  height: z.number().min(300).max(1800),
  shape: z.enum(["rectangle", "l-shape", "polygon"]),
  points: z
    .array(
      z.object({
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
      }),
    )
    .max(40)
    .default([]),
  walls: z
    .array(
      z.object({
        id,
        x1: z.number().min(0).max(100),
        y1: z.number().min(0).max(100),
        x2: z.number().min(0).max(100),
        y2: z.number().min(0).max(100),
        kind: z.enum(["wall", "door", "window"]),
      }),
    )
    .max(100)
    .default([]),
  tables: z
    .array(
      z.object({
        id,
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        w: z.number().min(3).max(95),
        h: z.number().min(3).max(95),
        rotation: z.number().min(0).max(360).default(0),
        shape: z.enum(["rectangle", "ellipse", "round"]).default("rectangle"),
        label: z.string().max(60),
      }),
    )
    .max(80),
});
function validatePlan(plan) {
  if (plan.shape === "polygon" && plan.points.length < 3)
    throw fail(400, "יש להגדיר לפחות שלוש פינות לצורת החדר");
  for (const w of plan.walls)
    if (w.x1 === w.x2 && w.y1 === w.y2)
      throw fail(400, "לקיר נדרשות שתי נקודות שונות");
}

exports.fail = fail;
exports.parse = parse;
exports.id = id;
exports.short = short;
exports.note = note;
exports.timestamp = timestamp;
exports.scheduleSchema = scheduleSchema;
exports.assetSchema = assetSchema;
exports.cleanAsset = cleanAsset;
exports.applyDependents = applyDependents;
exports.validateDependencies = validateDependencies;
exports.planSchema = planSchema;
exports.validatePlan = validatePlan;
