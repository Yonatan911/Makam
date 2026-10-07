"use strict";
const ExcelJS = require("exceljs");
const {
  aggregate,
  readiness,
  readinessBand,
  freshness,
  scheduleState,
  CATEGORIES,
} = require("../shared/model.js");
const { globalAccess } = require("./base-access.js");
const { fail } = require("./validation.js");

const commandDate = (value) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("he-IL", {
        timeZone: "Asia/Jerusalem",
        hourCycle: "h23",
      })
    : "—";
const time = (value) => Date.parse(value) || 0;
function checkState(room, settings, now) {
  if (room.maintenance) return "planned";
  if (
    (room.requests || []).some((r) => r.status === "approved") ||
    (settings.round?.roomIds?.includes(room.id) &&
      room.lastCheck?.roundId !== settings.round.id)
  )
    return "pending";
  if (!time(room.lastCheck?.at)) return "never";
  return freshness(room, settings, now);
}
function slaMetrics(faults, now) {
  const result = {
    eligible: 0,
    met: 0,
    breached: 0,
    openBreached: 0,
    withoutTarget: 0,
    unknownClosure: 0,
    percent: null,
  };
  for (const fault of faults.filter((f) => f.status !== "maintenance")) {
    const due = time(fault.slaAt || fault.dueAt);
    if (!due) {
      result.withoutTarget++;
      continue;
    }
    result.eligible++;
    if (fault.status === "closed" && !time(fault.closedAt)) {
      result.unknownClosure++;
      continue;
    }
    const late = (fault.status === "closed" ? time(fault.closedAt) : now) > due;
    if (late) {
      result.breached++;
      if (fault.status !== "closed") result.openBreached++;
    } else result.met++;
  }
  result.percent = result.eligible
    ? Math.round((100 * result.met) / result.eligible)
    : null;
  return result;
}
function summarizeBase(base, rooms, settings, now = Date.now()) {
  const metrics = aggregate(rooms, true, settings);
  const checks = {
    fresh: 0,
    aging: 0,
    expired: 0,
    never: 0,
    pending: 0,
    planned: 0,
  };
  const roomRows = rooms.map((room) => {
    const check = checkState(room, settings, now);
    checks[check]++;
    const m = readiness(room, settings);
    return {
      id: room.id,
      name: room.name,
      type: room.type,
      score: m.overall.score,
      check,
      scheduleOverdue: scheduleState(room, settings, now).overdue,
      lastCheckAt: room.lastCheck?.at || null,
    };
  });
  const faults = rooms.flatMap((room) =>
    (room.faults || [])
      .filter((f) => f.status !== "maintenance")
      .map((f) => {
        const asset = (room.assets || []).find((a) => a.id === f.assetId);
        return {
          id: f.id,
          roomId: room.id,
          roomName: room.name,
          assetName: asset?.name || f.assetName || "אמצעי",
          description: f.description || "",
          status: f.status,
          severity: f.severity,
          category: asset?.category || "other",
          assigneeId: f.assigneeId,
          assigneeText: f.assigneeText || "",
          openedAt: f.openedAt,
          closedAt: f.closedAt,
          slaAt: f.slaAt || f.dueAt,
          critical: !!asset?.critical || f.severity === "high",
        };
      }),
  );
  const open = faults.filter((f) => f.status !== "closed");
  const oldest = [...open]
    .filter((f) => time(f.openedAt))
    .sort((a, b) => time(a.openedAt) - time(b.openedAt))[0];
  const last =
    roomRows
      .map((r) => r.lastCheckAt)
      .filter(Boolean)
      .sort((a, b) => time(b) - time(a))[0] || null;
  const summary = {
    id: base.id,
    name: settings.baseName || "בסיס",
    score: metrics.overall,
    band: readinessBand(metrics.overall),
    categories: metrics.categories,
    assetCount: metrics.overallMetric.assetCount,
    excludedCount: metrics.overallMetric.excludedCount,
    explanation: metrics.overallMetric.explanation,
    roomCount: rooms.length,
    checks,
    validChecks: checks.fresh + checks.aging,
    checkExceptions: checks.expired + checks.never + checks.pending,
    lastCheckAt: last,
    openFaults: open.length,
    criticalFaults: open.filter((f) => f.critical).length,
    sla: slaMetrics(faults, now),
    oldestFault: oldest
      ? {
          description: oldest.description,
          roomName: oldest.roomName,
          ageDays: Math.max(
            0,
            Math.floor((now - time(oldest.openedAt)) / 86400000),
          ),
        }
      : null,
  };
  return {
    summary,
    rooms: roomRows.sort((a, b) => (a.score ?? 101) - (b.score ?? 101)),
    faults: open.map((f) => ({
      ...f,
      slaBreached: !!time(f.slaAt) && now > time(f.slaAt),
    })),
  };
}
function summarizeCommand(bases) {
  const total = {
    baseCount: bases.length,
    green: 0,
    orange: 0,
    red: 0,
    unknown: 0,
    basesWithCheckExceptions: 0,
    openFaults: 0,
    slaBreached: 0,
    assetCount: 0,
    score: null,
    sla: {
      eligible: 0,
      met: 0,
      breached: 0,
      openBreached: 0,
      withoutTarget: 0,
      unknownClosure: 0,
      percent: null,
    },
  };
  let weighted = 0;
  for (const base of bases) {
    total[base.band]++;
    total.basesWithCheckExceptions += Number(base.checkExceptions > 0);
    total.openFaults += base.openFaults;
    total.slaBreached += base.sla.breached;
    if (base.score !== null) {
      total.assetCount += base.assetCount;
      weighted += base.score * base.assetCount;
    }
    for (const key of Object.keys(total.sla).filter((k) => k !== "percent"))
      total.sla[key] += base.sla[key];
  }
  total.score = total.assetCount
    ? Math.round(weighted / total.assetCount)
    : null;
  total.sla.percent = total.sla.eligible
    ? Math.round((100 * total.sla.met) / total.sla.eligible)
    : null;
  return total;
}

async function commandWorkbook(data, dark = false) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "מכ״ם";
  const ws = wb.addWorksheet("תמונת מצב פיקודית", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
  });
  const headers = [
    "בסיס",
    "כשירות %",
    "צבע כשירות",
    "מחשוב %",
    "טלפוניה %",
    "תצוגה %",
    "יתירות %",
    "אמצעים",
    "מוחרגים",
    "מרחבים",
    "בדיקות בתוקף",
    "מתקרבות לפקיעה",
    "פג תוקף",
    "טרם נבדקו",
    "בדיקה יזומה ממתינה",
    "השבתה מתוכננת",
    "חריגות בדיקה",
    "בדיקה אחרונה",
    "פערים פתוחים",
    "פערים קריטיים",
    "חריגות SLA",
    "חריגות SLA פתוחות",
    "עמידה ב־SLA %",
    "פערים ללא SLA",
    "סגירה ללא תאריך",
    "הפער הוותיק ביותר",
    "גיל הפער בימים",
    "שינוי בנקודות",
    "מדידה קודמת",
    "עדכון הנתונים",
    "הסבר הכשירות",
  ];
  ws.columns = headers.map((header) => ({ header, width: 24 }));
  for (const b of data.bases)
    ws.addRow([
      b.name,
      b.score,
      { green: "ירוק", orange: "כתום", red: "אדום", unknown: "אין נתונים" }[
        b.band
      ],
      ...Object.keys(CATEGORIES).map((k) => b.categories[k]),
      b.assetCount,
      b.excludedCount,
      b.roomCount,
      b.validChecks,
      b.checks.aging,
      b.checks.expired,
      b.checks.never,
      b.checks.pending,
      b.checks.planned,
      b.checkExceptions,
      commandDate(b.lastCheckAt),
      b.openFaults,
      b.criticalFaults,
      b.sla.breached,
      b.sla.openBreached,
      b.sla.percent,
      b.sla.withoutTarget,
      b.sla.unknownClosure,
      b.oldestFault?.description || "—",
      b.oldestFault?.ageDays ?? null,
      b.trend?.delta ?? null,
      commandDate(b.trend?.previousAt),
      commandDate(data.generatedAt),
      b.explanation,
    ]);
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(ws.rowCount, 1), column: headers.length },
  };
  ws.eachRow((row, index) => {
    row.height = index === 1 ? 40 : 60;
    row.alignment = { vertical: "middle", wrapText: true };
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = {
        name: "Arial",
        bold: index === 1,
        color: { argb: index === 1 || dark ? "FFE4ECF4" : "FF243B48" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: index === 1 ? "FF243748" : dark ? "FF1A242F" : "FFF5F8FA",
        },
      };
    });
  });
  return wb;
}

async function installCommandOverview(app, raw) {
  const history = raw.collection("commandSnapshots");

  async function allowed(req) {
    if (!globalAccess(req.user))
      throw fail(
        403,
        "תמונת מצב פיקודית זמינה לבעלים ולמנהל מערכת פיקודי בלבד",
      );
    return raw
      .collection("bases")
      .find({ deletedAt: { $exists: false } })
      .toArray();
  }
  async function calculate(base, now) {
    const collection = raw.collection(base.prefix + "rooms");

    const [defaults, local, rooms] = await Promise.all([
      raw.collection("settings").findOne({ _id: "main" }),
      raw.collection(base.prefix + "settings").findOne({ _id: "main" }),
      collection
        .find(
          {},
          {
            projection: {
              assets: 1,
              faults: 1,
              requests: 1,
              lastCheck: 1,
              maintenance: 1,
              scheduleOverride: 1,
              id: 1,
              name: 1,
              type: 1,
            },
          },
        )
        .toArray(),
    ]);
    const settings = {
      ...defaults,
      ...local,
      schedule: local?.schedule ?? defaults?.schedule,
      freshnessDays: local?.freshnessDays ?? defaults?.freshnessDays,
    };
    const result = summarizeBase(base, rooms, settings, now);
    const bucket = Math.floor(now / 3600000);
    const previous = await history
      .find({ baseId: base.id, bucket: { $lt: bucket } })
      .sort({ bucket: -1 })
      .limit(1)
      .next();
    result.summary.trend = {
      previousAt: previous?.at || null,
      delta:
        previous?.score != null && result.summary.score != null
          ? result.summary.score - previous.score
          : null,
    };
    await history.updateOne(
      { baseId: base.id, bucket },
      {
        $setOnInsert: {
          baseId: base.id,
          bucket,
          at: new Date(now).toISOString(),
          score: result.summary.score,
        },
      },
      { upsert: true },
    );
    return result;
  }
  async function overview(req) {
    const bases = await allowed(req),
      now = Date.now(),
      results = [];
    for (const base of bases)
      results.push((await calculate(base, now)).summary);
    return {
      generatedAt: new Date(now).toISOString(),
      bases: results,
      totals: summarizeCommand(results),
    };
  }
  app.get("/api/command-overview", async (req, res) =>
    res.json(await overview(req)),
  );
  app.get("/api/command-overview/export", async (req, res) => {
    const data = await overview(req),
      wb = await commandWorkbook(data, req.query.theme === "dark");
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .set("Content-Disposition", 'attachment; filename="makam-command.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  });
  app.get("/api/command-overview/:baseId", async (req, res) => {
    const bases = await allowed(req),
      base = bases.find((b) => b.id === req.params.baseId);
    if (!base) throw fail(404, "הבסיס אינו זמין");
    const now = Date.now(),
      result = await calculate(base, now);
    const ids = [
      ...new Set(result.faults.map((f) => f.assigneeId).filter(Boolean)),
    ];
    const people = await raw
      .collection("users")
      .find(
        { id: { $in: ids } },
        { projection: { id: 1, name: 1, baseGrants: 1 } },
      )
      .toArray();
    result.faults = result.faults.map((f) => {
      const person = people.find((p) => p.id === f.assigneeId);
      const { assigneeId, ...safe } = f;
      return {
        ...safe,
        assignee:
          person?.baseGrants?.[base.id]?.name || person?.name || "ללא שיוך",
      };
    });
    const trend = await history
      .find({ baseId: base.id }, { projection: { _id: 0, at: 1, score: 1 } })
      .sort({ at: -1 })
      .limit(48)
      .toArray();
    res.json({
      ...result,
      generatedAt: new Date(now).toISOString(),
      trend: trend.reverse(),
    });
  });
}

exports.commandDate = commandDate;
exports.checkState = checkState;
exports.slaMetrics = slaMetrics;
exports.summarizeBase = summarizeBase;
exports.summarizeCommand = summarizeCommand;
exports.commandWorkbook = commandWorkbook;
exports.installCommandOverview = installCommandOverview;

async function ensureBaseIndexes(raw, base) {
  const rooms = raw.collection(base.prefix + "rooms");
  await rooms.createIndex({ id: 1 }, { unique: true });
  await rooms.createIndex({ type: 1 });
  await rooms.createIndex({ "lastCheck.at": 1 });
  await rooms.createIndex({ "faults.status": 1, "faults.slaAt": 1 });
  await rooms.createIndex({ "faults.dueAt": 1 });
  await rooms.createIndex({ "faults.closedAt": 1 });
  await rooms.createIndex({ "faults.severity": 1 });
  await raw
    .collection(base.prefix + "mailOutbox")
    .createIndex({ status: 1, leaseUntil: 1 });
}
module.exports.ensureBaseIndexes = ensureBaseIndexes;
