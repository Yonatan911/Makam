# מסירה לצוות DevOps — מכ״ם מרובת בסיסים, 07.10.2026

כל השינויים בוצעו בגרסה המקומית העדכנית variants/sharepoint-multibase, וחבילת Makam-SharePoint-MultiBase-20260919 עודכנה במקומה. נשמרו ריבוי הבסיסים, שש רמות ההרשאה, מידור, מסך הפיקוד, מפות, בדיקות וייצוא. לא הוחלפה המערכת בקוד GitHub ולא בוצע שינוי בשרת/SharePoint/נתוני ייצור.

מה נשאר תקול: מקור מלא שלא נמסר, מכסה משותפת ב־IPC, פערי CRLF/LF בבנייה וב־Git, וראיות ריצה שלא היו ניידות. אלה תוקנו. קבלה ארגונית עדיין אינה מוכחת.

## ממצאים

|ממצא|סטטוס|תוצאה|
|---|---|---|
|V01 מקור מלא ושחזור|FIXED|Git bundle מלא ו־ZIP מקור ב־SOURCE; clone נקי, npm ci offline, tests/build/package הצליחו. המאגר החיצוני לא עודכן; ניתן לייבא את ה־bundle ל־Git הפנימי.|
|V02 מכסת IPC|FIXED|שחזור Windows Named Pipe לפני התיקון ואחריו; מכסה לכל domain/SAM מאומת, 40 לדקה; אין שימוש ב־XFF/body או trust proxy.|
|V03 קבלה ארגונית|TARGET ENVIRONMENT REQUIRED|BLOCKED — TARGET ENVIRONMENT REQUIRED; הדגל TRUSTED_IDENTITY_VERIFIED אינו ראיה.|
|V04 parity/sופי שורות|FIXED|LF לפני עיבוד HTML ולפני manifest; ספקים/בינאריים לא השתנו; כל 4913 קובצי payload ו־manifest זהים בשחזור נקי.|
|טענות בדיקות ללא חומר לשחזור|FIXED|מקור הבדיקות, פקודות, exit codes, פלט גולמי, תוצאות IPC וצילומי Chrome כלולים.|
|IISNode ישיר, PORT, dotenv, Mongo, API runtime, טיוטות, מיגרציות, מידור וביטול session|ALREADY FIXED|רגרסיה מלאה הורצה; לא שוכתבו מודולים תקינים.|
|בדיקה חוזרת ישירה של ה־7z הישן|EVIDENCE MISSING|הארכיון לא סופק; ה־inventory וה־SHA של DevOps נשמרו כעדות חיצונית בלבד. ZIP חדש נבדק באופן עצמאי.|

## תוצאות ופקודות בפועל

סביבה: Windows x64, Node v24.19.0, MongoDB 8.0.30 מבודד ב־127.0.0.1:27028, Chrome 154.0.8037.98. הבדיקות משתמשות במסדי readiness_test_*; שירותי העבודה לא שונו.

|פקודה/שלב|תוצאה|עדות בתוך evidence.zip|
|---|---|---|
|node --test --test-reporter=tap tests/ipc-rate-limit.test.mjs לפני התיקון|שחזור כשל צפוי 0/7; warnings IP undefined/XFF|ipc-before.tap, before/ipc-rate-limit.json|
|אותה פקודה לאחר התיקון|7/7 PASS|ipc-after.tap, source/ipc-rate-limit.json|
|git clone SOURCE/makam-source.bundle לעץ חדש|exit 0, commit תואם|fresh-checkout/clone.txt, result.json|
|node npm-cli.js ci --ignore-scripts --no-audit --no-fund --offline|exit 0|fresh-checkout/install.txt|
|node scripts/lint.mjs|PASS|source/lint.txt|
|node scripts/test.mjs|103/103 PASS, אפס fail/skip|source/tests.txt|
|node scripts/build.mjs|PASS|source/build.txt|
|node --test --test-reporter=tap tests/browser.test.mjs מול המקור|1/1 PASS; 0 פניות חיצוניות ו־0 שגיאות; שני אזורי זמן ו־RTL/light/dark|source/browser.txt, browser/result.json וצילומים|
|node scripts/package.mjs מהעותק הנקי|exit 0, manifest ו־payload זהים|fresh-checkout/package.txt, result.json|
|node scripts/verify-delta.mjs package מול ה־ZIP המחולץ|42/42 PASS; בנוסף 1/1 Chrome|package/commands.json, tests.txt, browser.txt|
|node scripts/verify-release.mjs מול החילוץ|4913 hashes, CommonJS imports ו־Sharp native Windows PASS|package/verify.txt|
|node scripts/collect-evidence.mjs .verification/delta-20261007|86 קובצי עדות ו־evidence-manifest; hashes של כל פלט תואמים ל־commands|evidence-manifest.json, acceptance.json|

הפקודות המדויקות והנתיבים בעמדת הבנייה מופיעים ב־commands.json וב־fresh-checkout/result.json. הוראות לעמדה חדשה ב־GUIDE/REPRODUCING.he.md. Source/Package/Fresh checkout מסווגים REPRODUCED. ריצת הבסיס ההיסטורית 76/76 והבדיקות החיצוניות של DevOps מסווגות EVIDENCE PRESENT BUT NOT RE-RUN. בדיקות IIS/SharePoint/SMTP מסווגות TARGET ENVIRONMENT REQUIRED. הזרקת native headers בבדיקות מקומיות אינה הוכחה לחסימת התחזות ב־IIS.

## מקור וארטיפקטים

Git branch: remediation/iisnode-multibase-20261006

Source commit המלא: `7ead0bb8d6f2eebf7623f6a97b93d5a4105b671a` — 129 קבצים; commit נקי. Git bundle כולל היסטוריה מלאה עד snapshot המקור הרב־בסיסי. המאגר שנבדק לקריאה בלבד נשאר ב־f40a1665467c9f162f151113a591dd8c3cef32db ומכיל FRONT/SERVER/GUIDE/manifest בלבד.

מיקום החבילה: `C:\Users\yonat\Documents\ChatGPT\מערכת כשירות מרחבים\delivery\Makam-SharePoint-MultiBase-20260919`.

|קובץ|SHA-256|
|---|---|
|Makam-SharePoint-MultiBase-20260919.zip|ee962a39cadd266f1ea31fb4e97f5a73b935f03c34682b25f465abe7bc834492|
|manifest.json|1ed351a152632f58e553766c33304b8cd6d5faf72f21783a5a7a25526c3ec191|
|Makam-SharePoint-MultiBase-20260919.evidence.zip|4cd264555288239aea99b3406091a454cbfb1273428b299415d71e07ea507206|
|SOURCE/makam-source.bundle|83dc05866ecc1ebd4f73421d02db1a1e8a8e797fecf6e79c664e70da1103fa88|
|SOURCE/makam-source.zip|f482a4c8a20fde229d4e074ece203ca56a309c285727bfd161a1cec523987f39|

ה־ZIP המשוחזר קיבל SHA אחר (e52c3d7ada182112bda16e883e65d86ff7c1b687ed5bf03c904231289ab6490b) בגלל timestamps, בעוד שכל קובצי payload וה־manifest זהים. אין טענה לזהות בייטים בין ארכיוני ZIP עצמם. אין קשר בין גיבובים אלה ל־7z הישן שעליו דיווח DevOps.

SOURCE/ GUIDE לצוות התשתיות בלבד; FRONT ל־SharePoint, SERVER ליישום IIS הייעודי. אין .env אמיתי, מסדי נתונים, נתוני ריצה או סודות בחבילת הפריסה. אחרי התאמת runtime-config.js/override מאושר של web.config מתעדים hash חדש מקומי וסיבת שינוי, בלי לשנות manifest המקור. .env נוצר ונשמר רק בשרת.

## קבצים ששונו

|קובץ|סיבה|
|---|---|
|.gitattributes|מדיניות LF ובינאריים ללא שינוי|
|GUIDE/DELTA-TARGET.he.md|תיעוד תיקוני DevOps, שחזור וגבולות האימות|
|GUIDE/INSTALLATION.he.html|תיעוד תיקוני DevOps, שחזור וגבולות האימות|
|GUIDE/INSTALLATION.he.md|תיעוד תיקוני DevOps, שחזור וגבולות האימות|
|GUIDE/REPRODUCING.he.md|תיעוד תיקוני DevOps, שחזור וגבולות האימות|
|GUIDE/START-HERE.he.md|תיעוד תיקוני DevOps, שחזור וגבולות האימות|
|README.md|תיעוד תיקוני DevOps, שחזור וגבולות האימות|
|backend/legacy/Read-Proof.ps1|נרמול סופי שורות ב־Git בלבד, ללא שינוי לוגיקה|
|backend/src/auth.js|מכסת session נפרדת לזהות IIS מאומתת; דחייה מוקדמת ללא IP ב־IPC|
|deployment/delivery.gitattributes|מדיניות LF ובינאריים ללא שינוי|
|deployment/sharepoint/embed.html|נרמול סופי שורות ב־Git בלבד, ללא שינוי לוגיקה|
|deployment/sharepoint/loader.js|נרמול סופי שורות ב־Git בלבד, ללא שינוי לוגיקה|
|docs/CHANGED-FILES.md|תיעוד תיקוני DevOps, שחזור וגבולות האימות|
|docs/DELTA-REVIEW.he.md|תיעוד תיקוני DevOps, שחזור וגבולות האימות|
|docs/HANDOFF.he.md|תיעוד תיקוני DevOps, שחזור וגבולות האימות|
|docs/RELEASE-RESULTS.md|תיעוד תיקוני DevOps, שחזור וגבולות האימות|
|docs/TEST-RESULTS.md|תיעוד תיקוני DevOps, שחזור וגבולות האימות|
|frontend/index.html|נרמול סופי שורות ב־Git בלבד, ללא שינוי לוגיקה|
|frontend/vite.config.js|נרמול HTML לפני Vite למניעת שינוי שורות לפי checkout|
|scripts/collect-evidence.mjs|אריזה, אימות, שחזור וראיות ניידות — פירוט ב־DELTA-REVIEW|
|scripts/fresh-checkout.mjs|אריזה, אימות, שחזור וראיות ניידות — פירוט ב־DELTA-REVIEW|
|scripts/package.mjs|אריזה, אימות, שחזור וראיות ניידות — פירוט ב־DELTA-REVIEW|
|scripts/release-text.mjs|אריזה, אימות, שחזור וראיות ניידות — פירוט ב־DELTA-REVIEW|
|scripts/test.mjs|אריזה, אימות, שחזור וראיות ניידות — פירוט ב־DELTA-REVIEW|
|scripts/verify-delta.mjs|אריזה, אימות, שחזור וראיות ניידות — פירוט ב־DELTA-REVIEW|
|scripts/verify-release.mjs|אריזה, אימות, שחזור וראיות ניידות — פירוט ב־DELTA-REVIEW|
|tests/browser.test.mjs|רגרסיה של IPC/סופי שורות ותיעוד גרסת Chrome|
|tests/ipc-rate-limit.test.mjs|רגרסיה של IPC/סופי שורות ותיעוד גרסת Chrome|
|tests/release-text.test.mjs|רגרסיה של IPC/סופי שורות ותיעוד גרסת Chrome|

## שער היעד שנותר

BLOCKED — TARGET ENVIRONMENT REQUIRED. לפי GUIDE/DELTA-TARGET.he.md:

1. Node/IISNode המאושרים, named pipe, HTTPS, cold start/recycle, Mongo, Sharp והורדות ב־staging.
2. Windows Authentication ב־session הפיזי, AUTH_USER/AUTH_TYPE native, דחיית כותרות זהות זרות/כפולות לפני promotion ודחיית אנונימי.
3. OPTIONS ו־CORS מה־SharePoint האמיתי; React מקונן מקבל session וממופה ל־SAM הנכון בשני חשבונות; אין זהות מדפדפן כתחליף לאימות.
4. משתמש כבוי/לא משויך, ביטול משתמש/הרשאה/session ומידור baseId בשרת בפועל.
5. מכסות נפרדות לשני משתמשים דרך IIS; מכסה בזיכרון היא לכל process/endpoint ומתאפסת ב־recycle. הרחבה ל־workers/שרתים מחייבת store משותף/מדיניות IIS.
6. אם SMTP מופעל — שליחה פנימית, נמענים לפי בסיס ו־partial/unknown ללא replay עיוור.

אין לסמן אישור ייצור או TRUSTED_IDENTITY_VERIFIED=true על סמך בדיקות המחשב המקומי בלבד.
