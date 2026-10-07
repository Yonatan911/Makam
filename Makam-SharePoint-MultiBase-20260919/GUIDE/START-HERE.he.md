# מסירת מכ״ם מרובת בסיסים לצוות DevOps

הגרסה 3.1.0 מבוססת על המוצר המקומי האחרון, ולא על גרסת GitHub בעלת בסיס יחיד. נשמרו שש רמות ההרשאה, מידור בסיסים, הרשאות עצמאיות לאותו אדם בכל בסיס, ניהול מרכזי, תצ״א לכל בסיס, תמונת מצב פיקודית ופירוט/Excel/PNG.

הארכיטקטורה: SharePoint סטטי → HTTPS API ב־IISNode ישיר → MongoDB הארגוני. מקור: frontend/src, backend/src, shared. מסירה מחייבת: ../../delivery/Makam-SharePoint-MultiBase-20260919. באותו מיקום עודכנו FRONT, SERVER ו־GUIDE, עם manifest ו־ZIP/hash לצדו.

מדריך מחייב: INSTALLATION.he.md; רמות ההרשאה והתפעול: MULTIBASE.he.md; תמונת מצב פיקודית: COMMAND-OVERVIEW.he.md; עדויות: TEST-RESULTS.md ו־RELEASE-RESULTS.md; מטריצת שינוי: REMEDIATION-MATRIX.md; מלאי API: API-INVENTORY.md; רשימת קבצים: CHANGED-FILES.md.

תיקוני המשך מ־07.10.2026: DELTA-REVIEW.he.md; מקור מלא ופקודות שחזור: REPRODUCING.he.md; שער ארגוני שנותר: DELTA-TARGET.he.md. SOURCE כולל Git bundle ומקור ZIP ואינו מיועד לפרסום בשרת או ב־SharePoint. עדויות ריצה ניידות נמסרות ב־Makam-SharePoint-MultiBase-20260919.evidence.zip לצד המסירה.

לפני התקנה: אמתו את ה־ZIP וה־manifest עם Verify-Offline.ps1 באמצעות Node המאושר. אין npm/build/ARR/Node service/Mongo נוסף בשרת. צרו .env רק בשרת; PUBLIC_API_URL ו־runtime apiBaseUrl כוללים /api ו־prefix.

בצעו downtime וגיבוי ארגוני מלא, preflight ואז apply/verify. המיגרציה מכסה users/bases ו־rooms/settings של כל הבסיסים ומאפשרת resume/restore; מזהים, grants, תצ״א והיסטוריה נשמרים. בהתקנה חדשה בלבד m9267680 הוא owner ו־c9812933 הוא admin של הבסיס המקורי.

גבול אימות Windows דרך IISNode native נבדק בסימולציה מקומית, לא בשרת הארגון. אין אמון בשם משתמש שמגיע מ־JavaScript. TRUSTED_IDENTITY_VERIFIED נשאר false בייצור עד דוח DevOps לפי TARGET-CHECKLIST. זהו החסם החיצוני היחיד.

מקור נשמר בענף remediation/iisnode-multibase-20261006. baseline a22b4e12f100227af755cbea150948cda1d1b9f8; sourceCommit ורשימת commitsCreated מופיעים ב־manifest וב־release-report. עותק מסירה קודם ונתוני אימות מקומיים נשמרו תחת .verification ואינם כלולים במסירה.
