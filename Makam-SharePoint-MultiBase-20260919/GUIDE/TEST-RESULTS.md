# תוצאות בדיקות — תיקוני DevOps מ־07.10.2026

Windows x64, Node v24.19.0, MongoDB 8.0.30 מבודד ב־127.0.0.1:27028, Chrome מקומי מאושר. מסדי readiness_test_* בלבד; נתוני העבודה לא שונו. המספרים להלן מתייחסים לתיקון הנוכחי; זיהוי ה־commit, פלט גולמי ו־exit codes ב־commands.json של חבילת העדויות.

|הרצה|פקודה|תוצאה|
|---|---|---|
|Lint/JSX|`node scripts/lint.mjs`|PASS|
|כל רגרסיית היחידה/HTTP/Mongo/מידור/מיגרציה|`node scripts/test.mjs`|103/103 PASS, אפס fail/skip|
|בנייה מקומית מלאה|`node scripts/build.mjs`|PASS|
|Chrome אמיתי מול ספריית SharePoint מדומה ושני origins|`node --test --test-reporter=tap tests/browser.test.mjs`|1/1 PASS; RTL, light/dark, 24 שעות בשני אזורי זמן, ייצוא, שני עורכי מפה, הרשאות ובסיסים; אפס פניות חיצוניות ושגיאות דפדפן|
|IPC לפני התיקון|`node --test --test-reporter=tap tests/ipc-rate-limit.test.mjs`|שחזור הכשל הצפוי: 0/7; מכסה משותפת ואזהרות undefined-IP/XFF|
|IPC אחרי התיקון|אותה פקודה|7/7 PASS; Named Pipe אמיתי, שני משתמשים, quota נפרד, חסימת ניסיונות זיוף ואפס אזהרות|
|קובצי ZIP מחולצים: API/ריבוי בסיסים/IPC|`node scripts/verify-delta.mjs package .verification/extracted`|42/42 PASS, בנוסף 1/1 Chrome; קוד המוצר והתלויות נטענים מהחילוץ|
|אימות payload ותלויות Windows native|אותו runner, שלב verify|כל ה־hashes, imports ו־Sharp PASS; ספירת הקבצים המדויקת בדוח המסירה|
|clone מלא מה־SOURCE, npm ci offline, בדיקות/build/package|`node scripts/fresh-checkout.mjs`|REPRODUCED; payload ו־manifest זהים; פלט התקנה, בדיקות, דפדפן ואריזה מצורף|
|IIS/SharePoint/SMTP הארגוניים|לא הורץ|BLOCKED — TARGET ENVIRONMENT REQUIRED|

המקור המדויק של הבדיקות הוא `tests/` ב־SOURCE וב־Git. `verify-delta` מתעד את הפקודות ללא הסתמכות על מסמך תוצאות זה. `MAKAM_TEST_SERVER_ROOT` ו־`MAKAM_TEST_RELEASE_ROOT` מצביעים על SERVER/FRONT המחולצים. הזרקת כותרות native בבדיקה חיובית היא סימולציה מפורשת ואינה מוכיחה חסימת כותרות ב־IIS.

ראיות ניידות: `Makam-SharePoint-MultiBase-20260919.evidence.zip`, כולל evidence-manifest, acceptance, commands, פלט גולמי, IPC וצילומי מסך. פלט ריצת הבסיס ההיסטורית 76/76 נשמר תחת historical ומסווג EVIDENCE PRESENT BUT NOT RE-RUN. טענות 95/95 ו־35/35 מהמסירה הקודמת הוחלפו בריצות הנוכחיות, ולא הועתקו כהוכחה חדשה. בדיקות Linux/מסד double של DevOps נשמרות כעדות חיצונית בלבד.

בדיקות legacy של windows-proxy/proof נשמרות בתנאי test בלבד ולא נכללות ב־SERVER או מופעלות בייצור. בזמן אימות המקור נמצא שינוי לא מכוון מ־403 ל־404 בנתיב הכניסה הישנה; הוא תוקן, וההרצות הסופיות עברו ללא שינוי ציפיית הבדיקה.
