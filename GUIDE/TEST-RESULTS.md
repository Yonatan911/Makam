# תוצאות בדיקות — מכ״ם מרובת בסיסים 3.1.0

תאריך: 06.10.2026. מקור: variants/sharepoint-multibase, snapshot a22b4e12f100227af755cbea150948cda1d1b9f8. Windows x64, Node v24.19.0, MongoDB מבודד ב־127.0.0.1:27028; מסדי readiness_test_* בלבד. נתוני העבודה הקיימים לא שונו.

|סוג|תוצאה בפועל|
|---|---|
|בדיקות בסיס לפני שינוי|76/76 PASS|
|רגרסיה מלאה לאחר שינוי: יחידה, Node/HTTP/Mongo, migration ו־auth|95/95 PASS; 0 fail/skip|
|מידור רב־בסיסי המקורי|כל 13 תרחישי multibase PASS, כולל הרשאות מקומיות/מרכזיות, blind add, maps, reports, command overview ותפקידי משתמש שונים|
|מיגרציה רב־בסיסית חדשה|preflight ללא כתיבה, עצירה בבסיס שני, resume, idempotence ו־restore; grants, maps, rooms, history ו־mailOutbox נשמרים|
|עובדי דואר חדשים|שני workers במקביל, נמענים ותורים נפרדים, Message-ID נפרד והחרגת בסיס מחוק PASS; transport בדיקה, לא SMTP אמיתי|
|CommonJS/bootstrap ב־Windows|Named Pipe עם HTTP אמיתי, argv/interceptor, קדימות host והפעלה ללא mutation PASS|
|Frontend|runtime/prefix, שגיאות HTML, query לייצוא, no replay, טיוטות ו־24 שעות PASS|
|Lint ו־JSX|PASS|
|Chromium אמיתי מקומי|PASS: SharePoint library מדומה מקוננת, שני origins, GET/POST/PUT/PATCH/DELETE, Excel/PNG, RTL ו־Dark/Light, שני אזורי זמן, upload ותמונות, שני עורכי מפה עם conflict וטיוטה שמורה|
|ריבוי בסיסים בדפדפן|2 בסיסים, בחירה ובדיקה שאין מרחבים של בסיס אחר; command Excel/PNG; בורר מוסתר ומסך פיקודי חסום למנהל יחיד PASS|
|רשת ושגיאות דפדפן|0 בקשות חיצוניות; 0 page errors|
|SERVER מחולץ מה־ZIP בפועל|35/35 בדיקות API ותהליכים רב־בסיסיים PASS; 0 fail/skip|
|FRONT ו־SERVER מחולצים — Chromium|PASS, כולל Excel/PNG פיקודיים, שני בסיסים, שני עורכי מפה, RTL ו־Dark/Light; 0 בקשות חיצוניות ו־0 שגיאות|
|אימות offline|4,905 קובצי payload אומתו מול manifest; ייבוא CommonJS ו־Sharp native ב־Windows x64 PASS|
|IIS/SharePoint/Node/SMTP ארגוניים|NOT RUN — אין גישה או דוח קבלת DevOps|

הבדיקות המקוריות של proof/windows-proxy נשמרו כמבחני תאימות ב־NODE_ENV=test בלבד. אינן הוכחה לגבול זהות Windows הארגוני ואינן נכללות במסירה או מותרות בייצור.

בדיקות על SERVER/FRONT מחולצים אינן מסתמכות על source modules: המשתנים MAKAM_TEST_SERVER_ROOT ו־MAKAM_TEST_RELEASE_ROOT מצביעים לחבילה שחולצה. תוצאתן והגיבובים בפועל ב־Makam-SharePoint-MultiBase-20260919.acceptance-local.json לצד החבילה.

עדויות ריצה גולמיות נשמרו ב־.verification, מחוץ למסירה: baseline tests, tests-final.txt, lint-final.txt, browser-tests.txt, browser/result.json ותמונות, extracted-api-tests.txt, extracted-browser-tests.txt.

במהלך הבדיקה תוקנו runtime שהופעל בעת import במקום bootstrap, חסימת query בייצוא פיקודי, יצירת shared לא אטומית, והשימוש במדריכי מסירה ישנים. תוצאות PASS מתייחסות לריצה הסופית לאחר התיקונים. אין דילוג על בדיקות כושלות ואין החלשת הרשאות.
