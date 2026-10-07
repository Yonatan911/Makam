"use strict";
const ExcelJS = require("exceljs");
const {
  CATEGORIES,
  STATUSES,
  ROLES,
  REQUEST_STATUSES,
  KINDS,
  activeAssets,
  readiness,
  freshness,
  aggregate,
  scheduleState,
  dependencyIds,
} = require("../shared/model.js");
function installReportRoutes({ app, rooms, users, manager, getSettings }) {
  app.get("/api/export", manager, async (req, res) => {
    const type = ["חמ״ל", "חד״ן"].includes(req.query.type)
        ? req.query.type
        : null,
      data = await rooms.find(type ? { type } : {}).toArray(),
      settings = await getSettings(),
      people = await users.find().toArray(),
      wb = new ExcelJS.Workbook();
    wb.creator = settings.appName;
    wb.created = new Date();
    function sheet(name, headers, rows) {
      const ws = wb.addWorksheet(name, {
        views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
      });
      ws.columns = headers.map((h) => ({ header: h, width: 26 }));
      rows.forEach((row) => ws.addRow(row.map((v) => v ?? "")));
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF243748" },
      };
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, ws.rowCount), column: headers.length },
      };
      ws.eachRow((r) => {
        r.alignment = { vertical: "middle", wrapText: true };
        r.height = 32;
      });
    }
    const fl = {
      fresh: "בדיקה בתוקף",
      aging: "בדיקה מתיישנת",
      expired: "נדרשת בדיקה",
      planned: "השבתה מתוכננת",
    };
    sheet(
      "סיכום כשירות",
      [
        "חתך",
        "מרחבים",
        "אמצעים פעילים",
        "כשירות %",
        ...Object.values(CATEGORIES).map((v) => v + " %"),
        "פערים פתוחים",
        "נדרשת בדיקה",
        "חריגה ממועד בדיקה",
      ],
      ["הכול", "חמ״ל", "חד״ן"].map((t) => {
        const list = t === "הכול" ? data : data.filter((r) => r.type === t),
          m = aggregate(list, false, settings);
        return [
          t,
          list.length,
          list.reduce((n, r) => n + activeAssets(r).length, 0),
          m.overall,
          ...Object.values(m.categories),
          list.reduce(
            (n, r) => n + r.faults.filter((f) => f.status !== "closed").length,
            0,
          ),
          list.filter((r) => freshness(r, settings) === "expired").length,
          list.filter((r) => scheduleState(r, settings).overdue).length,
        ];
      }),
    );
    sheet(
      "מרחבים",
      [
        "מרחב",
        "סוג",
        "כשירות %",
        "תוקף בדיקה",
        "בדיקה אחרונה",
        "טכנאי בודק",
        "מועד בדיקה נדרש",
        "חריגה",
        "הערכת מנהל מערכת",
      ],
      data.map((r) => {
        const s = scheduleState(r, settings);
        return [
          r.name,
          r.type,
          readiness(r, settings).overall.score,
          fl[freshness(r, settings)],
          r.lastCheck?.at,
          r.lastCheck?.actor,
          s.nextDueAt,
          s.overdue ? "כן" : "לא",
          r.note,
        ];
      }),
    );
    const inventoryRows = (archived) =>
      data.flatMap((r) =>
        r.assets
          .filter((a) => !!a.archived === archived)
          .map((a) => [
            r.name,
            r.type,
            a.name,
            KINDS[a.kind],
            CATEGORIES[a.category],
            a.network,
            a.ip,
            a.phone,
            a.serial,
            archived ? "הוסר מהמלאי" : STATUSES[a.status],
            a.critical ? "קריטי" : "רגיל",
            dependencyIds(a)
              .map((id) => r.assets.find((p) => p.id === id)?.name)
              .filter(Boolean)
              .join(", "),
            (a.backupIds || [])
              .map((id) => r.assets.find((p) => p.id === id)?.name)
              .filter(Boolean)
              .join(", "),
            a.archivedAt,
            a.archivedBy,
            a.archiveReason,
          ]),
      );
    const invHeaders = [
      "מרחב",
      "סוג מרחב",
      "שם אמצעי / שם מחשב",
      "סוג אמצעי",
      "תחום",
      "רשת",
      "כתובת IP",
      "מספר טלפון",
      "מספר סידורי",
      "מצב",
      "חשיבות",
      "רכיבים בתלות משביתה",
      "גיבוי אל־פסק",
      "מועד הסרה",
      "הוסר על ידי",
      "סיבת הסרה",
    ];
    sheet("מלאי פעיל", invHeaders, inventoryRows(false));
    sheet("ארכיון אמצעים", invHeaders, inventoryRows(true));
    sheet(
      "פערים והיסטוריה",
      [
        "מרחב",
        "אמצעי",
        "סטטוס",
        "תיאור",
        "פתיחה",
        "נפתח על ידי",
        "טכנאי מטפל",
        "פרטי מטפל נוספים",
        "יעד טיפול",
        "סגירה",
        "נסגר על ידי",
        "אופן סגירה",
        "הערת סגירה",
      ],
      data.flatMap((r) =>
        r.faults.map((f) => [
          r.name,
          r.assets.find((a) => a.id === f.assetId)?.name || f.assetName,
          STATUSES[f.status],
          f.description,
          f.openedAt,
          f.openedBy,
          people.find((u) => u.id === f.assigneeId)?.name,
          f.assigneeText || "",
          f.slaAt,
          f.closedAt,
          f.closedBy,
          {
            direct_admin: "סגירה מיידית — מנהל מערכת",
            verified: "תיקון ואימות",
            verified_during_check: "אומת במהלך בדיקת כשירות",
            asset_retired: "הסרת אמצעי מהמלאי",
          }[f.closureMode] || f.closureMode,
          f.closureNote,
        ]),
      ),
    );
    sheet(
      "מעברי סטטוס",
      ["מרחב", "אמצעי", "מזהה פער", "מועד", "מבצע", "סטטוס", "הערה"],
      data.flatMap((r) =>
        r.faults.flatMap((f) =>
          f.history.map((h) => [
            r.name,
            r.assets.find((a) => a.id === f.assetId)?.name,
            f.id,
            h.at,
            h.actor,
            STATUSES[h.status],
            h.note,
          ]),
        ),
      ),
    );
    sheet(
      "בדיקות וביצועים",
      [
        "שם טכנאי",
        "תפקיד",
        "בדיקות מלאות",
        "בדיקות ממוקדות",
        "פערים פתוחים בשיוך",
        "פערים שנסגרו",
        "ממוצע זמן טיפול בשעות",
      ],
      people
        .filter((u) =>
          ["owner", "command_admin", "admin", "technician"].includes(u.role),
        )
        .map((u) => {
          const logs = data
              .flatMap((r) => r.audit)
              .filter((a) => a.actorId === u.id),
            fs = data
              .flatMap((r) => r.faults)
              .filter((f) => f.assigneeId === u.id),
            closed = fs.filter((f) => f.closedAt);
          return [
            u.name,
            ROLES[u.role],
            logs.filter((a) => a.action === "בדיקת כשירות").length,
            logs.filter((a) => a.action === "בדיקה ממוקדת").length,
            fs.filter((f) => f.status !== "closed").length,
            closed.length,
            closed.length
              ? (
                  closed.reduce(
                    (n, f) =>
                      n +
                      (new Date(f.closedAt) - new Date(f.openedAt)) / 3600000,
                    0,
                  ) / closed.length
                ).toFixed(1)
              : "",
          ];
        }),
    );
    sheet(
      "בקשות בדיקה",
      [
        "מרחב",
        "מבקש",
        "מועד מבוקש",
        "סיבה",
        "מה נדרש לבדוק",
        "היקף",
        "מצב",
        "החלטת מנהל",
        "מועד השלמה",
        "טכנאי מבצע",
      ],
      data.flatMap((r) =>
        (r.requests || []).map((q) => [
          r.name,
          q.requestedBy,
          q.requestedFor,
          q.reason,
          q.details,
          q.scope === "full"
            ? "בדיקה מלאה"
            : q.assetIds
                .map((id) => r.assets.find((a) => a.id === id)?.name)
                .join(", "),
          REQUEST_STATUSES[q.status],
          q.reviewNote,
          q.completedAt,
          q.completedBy,
        ]),
      ),
    );
    sheet(
      "יומן פעולות",
      ["מרחב", "מועד", "מבצע", "פעולה", "פירוט"],
      data.flatMap((r) =>
        r.audit.map((a) => [r.name, a.at, a.actor, a.action, a.detail]),
      ),
    );
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .set(
        "Content-Disposition",
        `attachment; filename="readiness-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      );
    await wb.xlsx.write(res);
    res.end();
  });
}

exports.installReportRoutes = installReportRoutes;
