"use strict";
const { randomUUID } = require("node:crypto");
const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
function sampleRooms() {
  return [
    "חמ״ל מרכזי",
    "חדר דיונים פיקודי",
    "חמ״ל אג״ם",
    "חמ״ל לוגיסטיקה",
    "חמ״ל תקשוב",
    "חדר דיונים צפוני",
    "חמ״ל מודיעין",
    "חמ״ל גיבוי",
  ].map((name, i) => {
    const id = randomUUID();
    const matrix = randomUUID();
    const ups = randomUUID();
    const defs = [
      ["מטריצת תצוגה", "matrix", "display", true, matrix],
      ["מסך ראשי", "screen", "display"],
      ["מסך משני", "screen", "display"],
      ["עמדת מפעיל 01", "computer", "computing"],
      ["עמדת מפעיל 02", "computer", "computing"],
      ["מתג תקשורת", "switch", "computing", true],
      ["טלפון פיקודי", "phone", "telephony"],
      ["טלפון קווי", "phone", "telephony"],
      ["אל־פסק מרכזי", "ups", "power", true, ups],
    ];
    const assets = defs.map(([label, kind, category, critical, aid], j) => ({
      id: aid || randomUUID(),
      name: label,
      kind,
      category,
      critical: !!critical,
      status: "healthy",
      severity: "high",
      network: j % 3 === 0 ? "אדומה" : "שחורה",
      ip: category === "computing" ? `192.0.2.${i * 10 + j + 1}` : "",
      phone: kind === "phone" ? `000-${1000 + i * 10 + j}` : "",
      serial: `DEMO-${i + 1}-${j + 1}`,
      parentId: kind === "screen" ? matrix : kind === "computer" ? ups : null,
      dependency:
        kind === "screen"
          ? "hard"
          : kind === "computer"
            ? "redundancy"
            : "none",
      x: 10 + (j % 3) * 33,
      y: 15 + Math.floor(j / 3) * 31,
    }));
    const faults = [];
    if ([0, 2, 4, 5].includes(i)) {
      const a = assets[i === 0 ? 8 : i === 2 ? 0 : i === 4 ? 3 : 6];
      a.status = i === 0 ? "waiting" : i === 2 ? "in_progress" : "faulty";
      a.note =
        i === 0
          ? "הסוללה אינה מחזיקה עומס. נדרש להחליף מצברים."
          : i === 2
            ? "אין אות מהמטריצה לשני המסכים."
            : "נדרש אבחון טכנאי";
      faults.push({
        id: randomUUID(),
        assetId: a.id,
        status: a.status,
        severity: "high",
        description: a.note,
        openedAt: ago(i === 0 ? 2 : 1),
        openedBy: "נתוני דוגמה",
        assigneeId: "",
        slaAt: ago(i === 0 ? -0.5 : 0.2),
        closureNote: "",
        history: [
          { at: ago(2), actor: "נתוני דוגמה", status: "faulty", note: a.note },
        ],
      });
    }
    return {
      _id: id,
      id,
      name,
      zone: i < 4 ? "מרחב מרכז" : i < 7 ? "מרחב צפון" : "מרחב גיבוי",
      type: name.includes("דיונים") ? "חד״ן" : "חמ״ל",
      maintenance: i === 7,
      note:
        i === 0
          ? "פער מוכר באל־פסק. הוזמנו מצברים; נדרש לוודא זמינות הזנת חשמל חלופית."
          : "",
      assets,
      faults,
      audit: [],
      version: 1,
      lastCheck:
        i === 6
          ? null
          : {
              at: ago(i === 5 ? 9 : i === 3 ? 6 : 0.3),
              actor: "מנהל הדוגמה",
              roundId: null,
            },
      plan: {
        width: 900,
        height: 560,
        shape: "rectangle",
        tables: [
          {
            id: randomUUID(),
            x: 28,
            y: 43,
            w: 44,
            h: 16,
            label: "שולחן עבודה",
          },
        ],
      },
      demo: true,
    };
  });
}

exports.sampleRooms = sampleRooms;
