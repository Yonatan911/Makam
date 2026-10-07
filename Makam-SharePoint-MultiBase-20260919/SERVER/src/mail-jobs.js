"use strict";
const nodemailer = require("nodemailer");
const randomUUID = require("node:crypto").randomUUID;
const localParts = require("../shared/model.js").localParts;
const WEEKDAYS = require("../shared/model.js").WEEKDAYS;
function createMailJobs(
  db,
  origin,
  transportFactory = nodemailer.createTransport,
  baseId = "single",
) {
  let running = false,
    stopped = false;
  const workerId = randomUUID();
  async function queueEvents() {
    for (const room of await db
      .collection("rooms")
      .find({
        "mailEvents.0": {
          $exists: true,
        },
      })
      .toArray()) {
      for (const event of room.mailEvents) {
        const request = room.requests?.find((r) => r.id === event.requestId);
        const titles = {
          request_created: "בקשת בדיקה חדשה",
          request_approved: "בקשת הבדיקה אושרה",
          request_rejected: "בקשת הבדיקה לא אושרה",
          request_cancelled: "בקשת הבדיקה בוטלה",
          request_completed: "הבדיקה המבוקשת הושלמה",
        };
        await db.collection("mailOutbox").updateOne(
          {
            _id: event.id,
          },
          {
            $setOnInsert: {
              _id: event.id,
              id: event.id,
              createdAt: event.at,
              status: "pending",
              kind: "request",
              eventType: event.type,
              roomId: room.id,
              requesterId: event.requesterId,
              subject: `${titles[event.type] || "עדכון בדיקה"} — ${room.name}`,
              text: `${titles[event.type] || "עדכון בדיקה"}\nמרחב: ${room.name}\nמועד מבוקש: ${request?.requestedFor || ""}\nסיבה: ${request?.reason || ""}\nפירוט: ${request?.details || ""}\nעדכון: ${event.detail}\nעודכן על ידי: ${event.actor}\nכניסה למערכת: ${origin}`,
            },
          },
          {
            upsert: true,
          },
        );
      }
    }
  }
  async function tick(now = Date.now()) {
    if (running || stopped) return;
    running = true;
    try {
      const settings = await db.collection("settings").findOne({
        _id: "main",
      });
      if (!settings) return;
      // A crashed sender may have delivered. Never blindly resend an expired lease.
      await db.collection("mailOutbox").updateMany(
        {
          status: "sending",
          $or: [
            { leaseUntil: { $lte: new Date() } },
            { leaseUntil: { $exists: false } },
          ],
        },
        {
          $set: {
            status: "outcome_unknown",
            lastError:
              "העובד הופסק בזמן השליחה. יש לבדוק ביומן SMTP אם ההודעה נמסרה; אין ניסיון חוזר אוטומטי.",
          },
        },
      );
      await db.collection("mailOutbox").updateMany(
        { status: "failed", attemptedAt: { $exists: true } },
        {
          $set: {
            status: "outcome_unknown",
            lastError:
              "ניסיון שליחה בגרסה קודמת. יש לבדוק יומן SMTP לפני ניסיון נוסף.",
          },
        },
      );
      await queueEvents();
      const p = localParts(now),
        weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(),
        hhmm =
          String(p.hour).padStart(2, "0") +
          ":" +
          String(p.minute).padStart(2, "0");
      if (
        settings.remindersEnabled &&
        weekday === settings.reminderDay &&
        hhmm >= settings.reminderTime
      ) {
        const key = `weekly-${p.year}-${p.month}-${p.day}`;
        await db.collection("mailOutbox").updateOne(
          {
            _id: key,
          },
          {
            $setOnInsert: {
              _id: key,
              id: key,
              kind: "weekly",
              status: "pending",
              createdAt: new Date(now).toISOString(),
              subject: `תזכורת לבדיקת כשירות — ${settings.baseName}`,
              text: `יש להשלים את בדיקות הכשירות.\nיום הבדיקה שנקבע: ${WEEKDAYS[settings.schedule.day]} עד ${settings.schedule.time}.\nכניסה למערכת: ${origin}`,
            },
          },
          {
            upsert: true,
          },
        );
      }
      for (const job of await db
        .collection("mailOutbox")
        .find({
          status: "pending",
        })
        .limit(30)
        .toArray()) {
        if (stopped) break;
        const enabled =
          job.kind === "weekly"
            ? settings.remindersEnabled
            : settings.requestMailEnabled;
        if (!enabled || !process.env.SMTP_HOST || !process.env.SMTP_FROM) {
          await db.collection("mailOutbox").updateOne(
            {
              _id: job._id,
              status: "pending",
            },
            {
              $set: {
                status: "waiting_configuration",
                lastError: "שליחת דוא״ל אינה מופעלת או ששרת הדואר לא הוגדר",
              },
            },
          );
          continue;
        }
        let recipients = settings.recipients || [];
        if (job.kind === "request") {
          const query =
            job.eventType === "request_created"
              ? {
                  role: {
                    $in: ["owner", "command_admin", "admin"],
                  },
                }
              : {
                  $or: [
                    {
                      role: {
                        $in: ["owner", "command_admin", "admin"],
                      },
                    },
                    {
                      id: job.requesterId,
                    },
                    {
                      role: "technician",
                      $or: [
                        {
                          roomIds: job.roomId,
                        },
                        {
                          allRooms: true,
                        },
                      ],
                    },
                  ],
                };
          recipients = (
            await db
              .collection("users")
              .find({
                active: true,
                ...query,
              })
              .toArray()
          )
            .map((u) => u.email)
            .filter(Boolean);
        }
        recipients = [...new Set(recipients)];
        if (!recipients.length) {
          await db.collection("mailOutbox").updateOne(
            {
              _id: job._id,
              status: "pending",
            },
            {
              $set: {
                status: "no_recipients",
                lastError: "למשתמשים הרלוונטיים לא הוגדרו כתובות דוא״ל",
              },
            },
          );
          continue;
        }
        const claimed = await db.collection("mailOutbox").findOneAndUpdate(
          {
            _id: job._id,
            status: "pending",
          },
          {
            $set: {
              status: "sending",
              attemptedAt: new Date().toISOString(),
              workerId,
              leaseUntil: new Date(Date.now() + 120000),
            },
          },
          {
            returnDocument: "after",
          },
        );
        if (!claimed) continue;
        let heartbeat, transport;
        try {
          heartbeat = setInterval(
            () =>
              db
                .collection("mailOutbox")
                .updateOne(
                  { _id: job._id, status: "sending", workerId },
                  { $set: { leaseUntil: new Date(Date.now() + 120000) } },
                )
                .catch(() => {}),
            20000,
          );
          heartbeat.unref();
          transport = transportFactory({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === "true",
            requireTLS: process.env.SMTP_SECURE !== "true",
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 10000,
            disableFileAccess: true,
            disableUrlAccess: true,
            auth: process.env.SMTP_USER
              ? {
                  user: process.env.SMTP_USER,
                  pass: process.env.SMTP_PASSWORD,
                }
              : undefined,
          });
          const delivery = await transport.sendMail({
            from: process.env.SMTP_FROM,
            to: recipients,
            subject: job.subject,
            text: job.text,
            messageId: `<${baseId}.${job.id}@readiness.local>`,
          });
          await db.collection("mailOutbox").updateOne(
            {
              _id: job._id,
              status: "sending",
              workerId,
            },
            {
              $set: {
                status: delivery.rejected?.length ? "partial" : "sent",
                accepted: delivery.accepted || [],
                rejected: delivery.rejected || [],
                sentAt: new Date().toISOString(),
                lastError: delivery.rejected?.length
                  ? "שרת הדואר דחה חלק מהנמענים. יש לבדוק את יומן הדואר לפני שליחה נוספת."
                  : "",
              },
            },
          );
        } catch {
          await db.collection("mailOutbox").updateOne(
            {
              _id: job._id,
              status: "sending",
              workerId,
            },
            {
              $set: {
                status: "outcome_unknown",
                lastError:
                  "תוצאת SMTP אינה ידועה. יש לבדוק ביומן הדואר אם ההודעה נמסרה לפני החלטה ידנית.",
              },
            },
          );
        } finally {
          clearInterval(heartbeat);
          transport?.close?.();
        }
      }
    } finally {
      running = false;
    }
  }
  return {
    tick,
    stop: () => {
      stopped = true;
    },
  };
}
exports.createMailJobs = createMailJobs;
