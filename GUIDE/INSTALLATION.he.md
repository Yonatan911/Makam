# מכ״ם — מסירה ל־DevOps: IISNode ו־SharePoint

גרסה 3.1.0 — המהדורה המקומית האחרונה מרובת הבסיסים. המקור המחייב הוא variants/sharepoint-multibase, עם תמונת מצב פיקודית, שש רמות הרשאה, מפות נפרדות והרשאות לכל בסיס. snapshot לפני השינוי: a22b4e12f100227af755cbea150948cda1d1b9f8. אין החלפה בגרסת GitHub בעלת בסיס יחיד.

## מצב האימות

הקוד וחבילת המסירה נבדקים מקומית ב־Windows מול מסד מבודד. **בדיקות שרת IIS וחוות SharePoint של הארגון: NOT RUN.** חבילת זו אינה אישור לעלות לייצור. לפני העלאה נדרש דוח קבלה של DevOps שמוכיח את גרסת Node/IISNode המותקנת ואת גבול האימות: Windows Authentication פעיל ב־`api/auth/session.js`, קידום `AUTH_USER,AUTH_TYPE` על ידי IISNode, חסימת כותרות זהות שהלקוח מנסה לשלוח, וטעינה אמיתית מ־SharePoint. בלי הוכחה ההזדהות בייצור נשארת חסומה.

## הארכיטקטורה והקבצים

SharePoint מארח את React וקובצי CSS, גופנים ותמונות באופן מקומי. IISNode מפעיל ישירות את `SERVER/src/server.js`; אין ARR, שירות Node נפרד, חלון PowerShell קבוע, Mongo נוסף או npm בשרת. MongoDB הוא השירות הארגוני הקיים במסד יישום מוגדר.

```text
frontend/src/                 מקור React והלוגיקה הקיימת
frontend/src/config/          חוזה runtime ציבורי
frontend/src/services/        API והזדהות אחידים
frontend/src/hooks/           רענון וטיוטות עם גרסת בסיס
frontend/src/features/        מפת בסיס
backend/src/server.js         הפעלה, Named Pipe, עצירה
backend/src/app.js            Express ללא listener או מיגרציה בייבוא
backend/src/config.js         תצורה מאומתת ביחס לשורש backend
backend/src/migrations.js     preflight/plan/apply/resume/restore
backend/api/auth/session.js   כניסת IISNode דקה לאימות Windows
shared/                      חישובי כשירות והרשאות משותפים
deployment/                  loader וסקריפטי קבלה בלבד
../../delivery/Makam-SharePoint-MultiBase-20260919/FRONT/           כל מה שמעלים לספריית SharePoint
../../delivery/Makam-SharePoint-MultiBase-20260919/SERVER/          כל מה שמעלים ליישום IIS
../../delivery/Makam-SharePoint-MultiBase-20260919/GUIDE/           מדריכים ובדיקות קבלה
../../delivery/Makam-SharePoint-MultiBase-20260919/manifest.json    SHA-256 לכל קובץ, גרסה ו־commit
```

`backend/shared` הוא פלט שנוצר מ־`shared`, ואינו מקור נוסף לעריכה. `.build/FRONT` הוא staging של בנייה אחת בלבד; `../../delivery/Makam-SharePoint-MultiBase-20260919/FRONT` הוא העותק המחייב למסירה. אין dist נוסף או FRONT שנערך ידנית במאגר.

## דרישות סביבת השרת

Windows x64, התקנת IISNode מאושרת, URL Rewrite, Windows Authentication, Node מאושר **22.12.0 ומעלה**. התלויות ננעלו ו־Sharp נבדק על Windows x64 בגרסת Node של תחנת הבנייה. חובה להפעיל את בדיקת החבילה גם באמצעות Node המדויק של IISNode בשרת; אם הוא ישן יותר, אין להעתיק Node אקראי — יש לתאם גרסה מאושרת או לבצע התאמת תלויות נפרדת. IISNode יורש `nodeProcessCommandLine` מתצורת השרת; יש לוודא שהוא נתיב מלא לבינארי המאושר, ולא תלוי ב־PATH.

יש להקצות יישום IIS נפרד, למשל `/makam`, ב־Application Pool מתאים: No Managed Code, x64, הרשאות קריאה לקוד ולתלויות, גישת רשת למסד ול־SMTP הפנימיים, וכתיבה מוגבלת לתיקיות הלוגים הנחוצות של IISNode. הקוד אינו דורש כתיבה לתיקיות מקור. אין לשנות web.config של חוות SharePoint או של יישומים אחרים.

## הגדרות וקדימות

ערכי IIS/Host גוברים על `SERVER/.env`, ואחריהם יש רק ברירות מחדל לפיתוח. `.env` נקרא ביחס ל־SERVER גם אם cwd שונה. `PORT` של IISNode נשאר Named Pipe בדיוק כפי שהוזרק. **אין להגדיר PORT ב־.env של ייצור.**

| ערך | סוג ומיקום | שימוש |
|---|---|---|
| PORT | Host בלבד | Named Pipe שמזריק IISNode |
| NODE_ENV | Host/שרת | production |
| AUTH_MODE | שרת | iis-session בלבד בייצור |
| TRUSTED_IDENTITY_VERIFIED | שרת, שער קבלה | false עד אימות הגבול בסביבת staging; אינו הוכחה כשלעצמו |
| MONGODB_URI | סוד שרת | URI מלא לשירות הארגוני, TLS והרשאות בהתאם למדיניות; אין לרשום בלוג |
| MONGODB_DATABASE | שרת | שם מסד יישום מבודד, לא admin/local/config |
| AD_DOMAIN | שרת | ARMY |
| PUBLIC_API_URL | שרת | URL מלא ב־HTTPS כולל prefix ו־/api, למשל https://api.internal/makam/api |
| APP_PUBLIC_URL | שרת | כתובת עמוד SharePoint, משמשת בקישורי דואר |
| SHAREPOINT_ORIGIN | שרת | origin מדויק בלבד, למשל https://sp.internal, בלי path |
| CORS_ORIGINS | שרת, אופציונלי | origins מאושרים נוספים, מופרדים בפסיקים; אין * |
| BOOTSTRAP_OWNER_SAM | setup בלבד | m9267680. חל רק כשמסד חדש ואין משתמשים |
| BOOTSTRAP_ADMIN_SAM | setup בלבד | c9812933. אינו משנה הקצאות קיימות |
| JOBS_ENABLED | שרת | הפעלת worker דואר בתוך IISNode; false עד בדיקת SMTP/IIS |
| SMTP_HOST/PORT/SECURE/FROM | שרת, אופציונלי | SMTP פנימי, TLS נדרש; SECURE=true ל־TLS ישיר |
| SMTP_USER/PASSWORD | סודות שרת | אם שירות SMTP דורש אימות |
| LDAP_URL/BASE_DN/BIND_DN/BIND_PASSWORD | שרת/סודות, אופציונלי | LDAPS בלבד; העשרת פרטי משתמש קיים, אינה מעניקה הרשאות |
| MAKAM_RUNTIME_CONFIG | ציבורי ב־FRONT/runtime-config.js | schemaVersion, apiBaseUrl, environment, releaseVersion, authMode; אין סודות |
| ENABLE_LOCAL_TEST_LOGIN | פיתוח בלבד | נדרש מפורשות ל־local-test; אסור בייצור |
| AUTO_INITIALIZE_TEST_DB | בדיקות בלבד | מפורש, NODE_ENV=test ו־readiness_test_* בלבד |

חבילה כוללת `.env.example` בלבד. יוצרים `.env` בשרת ומגבילים ACL למנהלי התשתית ולזהות Application Pool. אין להעלות אותו ל־SharePoint, Git או ZIP מסירה.

## בנייה ואריזה בתחנת פיתוח מורשית

משתמשים ב־Node/npm מאושרים. הפקודות משורש המאגר:

```powershell
npm ci --ignore-scripts
npm run lint
npm test
npm run test:browser
npm run build
npm run package
npm run verify -- ../../delivery/Makam-SharePoint-MultiBase-20260919
```

הבדיקות דורשות שירות Mongo מבודד על 127.0.0.1:27028 ומסדי readiness_test_*. זו בחירה מפורשת לבדיקות בלבד; הפעלת השרת אינה מפעילה mongod. בדיקות הדפדפן משתמשות ב־Chrome מותקן, או בנתיב `CHROME_PATH`. סקריפטי בדיקות אינם בחבילת SERVER.

אריזה מתקינה **בתחנת הבנייה בלבד** סגירת תלויות production לפי backend/package-lock.json, ללא scripts, ולא מייצרת Node בינארי. ברירת המחדל של האריזה היא npm ci --offline. מכינים מראש cache מתאים; אם תחנת הבנייה מורשית לגשת לרישום, אפשר להגדיר פעם אחת `$env:PREPARE_DEPENDENCIES_ONLINE='true'`. כש־npm אינו לצד node.exe, מגדירים `NPM_CLI_PATH` לנתיב npm-cli.js המאושר. בשרת הסגור אין npm install או build.

לפיתוח: הגדירו ב־backend/.env `NODE_ENV=development`, `AUTH_MODE=local-test`, `ENABLE_LOCAL_TEST_LOGIN=true`, URI ושם מסד בדיקות. יצירת fixtures נעשית רק במצב בדיקה מפורש; הוראות `npm test` מטפלות במסדי בדיקות. `npm run dev` מפעיל backend TCP ו־`npm run dev --workspace frontend` מפעיל Vite. הממשק בפיתוח משתמש ב־frontend/public/runtime-config.js. ליצירת משתמשי בדיקה מקומיים מפורשות, הגדירו NODE_ENV=test, AUTO_INITIALIZE_TEST_DB=true ושם מסד readiness_test_local והריצו npm run setup:local. לאחר מכן npm run dev; אין ליצור fixtures במסד ארגוני. מסד ארגוני ריק דורש migrate.js apply מפורש. אין שימוש בשירותי ענן או CDN בזמן ריצה.

## התקנה ראשונה ב־IIS

1. חלצו את ZIP למסלול staging שאינו פרוס. בדקו את SHA-256 של הארכיון מול `Makam-SharePoint-MultiBase-20260919.sha256.txt`. שימו את SERVER בנתיב יישום IIS הייעודי, כולל node_modules; GUIDE נשאר לצוות התשתיות מחוץ לשורש האתר.
2. הריצו את `Verify-Offline.ps1` דרך Node המאושר לפני יצירת `.env`. הוא מאמת manifest, תלות native וייבוא אפליקציה ללא פתיחת listener.
3. צרו `.env` מ־`.env.example`, הזינו URI ארגוני וURLs, השאירו `TRUSTED_IDENTITY_VERIFIED=false`. התקנה או מיגרציה ידנית אינה דורשת לסמן שהזהות אומתה.
4. עצרו את יישום IIS והבטיחו שאין כתיבות אחרות. גבו את מסד היישום כולו בכלי הגיבוי הארגוניים המאושרים, כולל images, audit, users, sessions וmailOutbox.
5. הריצו מ־SERVER, באמצעות Node בנתיב המלא המאושר:

```powershell
& 'C:\Approved\Node\node.exe' .\scripts\migrate.js preflight
$env:CONFIRM_MIGRATION_DATABASE='makam'
& 'C:\Approved\Node\node.exe' .\scripts\migrate.js apply
& 'C:\Approved\Node\node.exe' .\scripts\migrate.js verify
Remove-Item Env:CONFIRM_MIGRATION_DATABASE
```

6. הגדרות Windows Authentication צריכות להיות מותרות/מואצלות ביישום IIS הייעודי. ב־`api/auth/session.js` Anonymous כבוי ו־Windows מופעל; בשאר API Anonymous ברמת IIS, עם הרשאות Bearer בצד השרת. OPTIONS מגיע ל־entry אנונימי. אין להתיר Anonymous בנתיב החלפת הזהות כדי לפתור שגיאה.
7. הריצו תחילה Inspect-Target לקריאה בלבד. אחרי שDevOps אישרו את הגדרות Windows Authentication, קידום native וחסימת כותרות לקוח, הגדירו `TRUSTED_IDENTITY_VERIFIED=true` **בstaging המבודד בלבד** כדי לאפשר את בדיקות Target-Smoke והדפדפן; ללא דגל זה השרת מסרב לעלות בייצור. הדגל הוא אישור מפורש להתחיל בבדיקה, ואינו הוכחת הצלחה. אם AUTH_USER ריק או כותרת מזויפת מתקבלת — החזירו false וחסמו את היישום. בפריסת הייצור השאירו false עד קבלת דוח בדיקות מאושר; אין fallback לשם מהדפדפן.

## משמעות web.config

הhandler הראשי מצביע ל־src/server.js לפי דוגמת IISNode שסופקה. כל API מנותב אליו; אין חריג IsFile ולכן קבצי קוד/config אינם מוגשים. נתיב session מנותב לכניסה הפיזית api/auth/session.js כדי שהרשאת Windows תחול גם אחרי Rewrite. הכניסה הדקה משתמשת באותו startServer; היא אינה שירות נוסף ואינה מפעילה worker דואר.

IISNode מקדם את AUTH_USER ואת AUTH_TYPE אחרי שלב אימות IIS לכותרות `x-iisnode-auth_user` ו־`x-iisnode-auth_type`. **זו אינה הכותרת בעלת המקפים x-iisnode-auth-user.** הכלל הראשון דוחה כל כותרת x-iisnode-* שסיפק לקוח לפני קידום native, וכן כותרות proxy/original URL שאינן מהימנות. Express דורש מופע יחיד של שתי הכותרות, סוג אימות Windows מוכר ודומיין מדויק. חשבון פעיל מוקצה ידנית במסד; אין גזירת תפקיד מגוף הבקשה, Header מהדפדפן או קבוצת AD. המשתמש וההרשאות נבדקים בכל בקשת API; תוקף session שמונה שעות. Token נשמר בזיכרון הדפדפן בלבד ומגובב במסד.

הפרדה זו נשענת על מנגנון promoteServerVars המתועד של IISNode: https://github.com/Azure/iisnode/blob/master/src/samples/configuration/web.config ועל קוד קידום הכותרות: https://github.com/Azure/iisnode/blob/master/src/iisnode/chttpprotocol.cpp. התנהגות הגרסה המותקנת בשרת חייבת להיבדק בפועל.

## העלאת FRONT ל־SharePoint

מעלים את **כל תוכן FRONT**, עם assets והתיקיות כפי שהן, למשל `/sites/operations/SiteAssets/Makam/`. עורכים רק runtime-config.js הציבורי לפני ההעלאה:

```javascript
window.MAKAM_RUNTIME_CONFIG=Object.freeze({
  schemaVersion:1,
  apiBaseUrl:'https://api.internal/makam/api',
  environment:'production',
  releaseVersion:'3.1.0',
  authMode:'iis-session'
});
```

apiBaseUrl כולל /api; אפשר origin ייעודי או prefix. בלי הגדרה תקינה React מציג שגיאת התקנה מפורשת ואינו קורא ל־/api של SharePoint. הURL אינו אפוי ב־bundle. שינוי runtime-config אחרי אימות manifest הוא שינוי תצורה מקומי מכוון: שמרו את הגיבוב החדש בדוח הפריסה, אין לשנות manifest מסירה כדי להסתיר שינוי.

בעמוד SharePoint קלאסי ובמנגנון Script Editor שמאושר בארגון, הוסיפו את script מתוך embed.html ועדכנו לנתיב הספרייה. loader.js טוען את index.html באותו origin, מציב base לנתיב המקונן ומציג srcdoc iframe. הוא אינו מנהל הזדהות, הרשאות או עסקאות. צריך להתיר סקריפט מקומי במנגנון העמוד המאושר; אין לכבות אבטחה כללית בחווה. ייתכן שמנגנון העמוד של Subscription Edition שונה — יש לקבל מצוות SP שם גרסה מדויק ומנגנון הטמעה מאושר, ולא להניח מוצר בשם “2022”.

בדקו ב־Network שהקבצים אינם דפי HTML/התחברות וש־MIME תקין: JS application/javascript, CSS text/css, WOFF/WOFF2 font/woff וfont/woff2, PNG image/png. יש לבדוק runtime-config.js לפני React. אין טעינה מגופני רשת, CDN, Graph או MSAL. SharePoint לבדו אינו הוכחת זהות לשרת; בקשת session עם credentials מגיעה ל־IIS המאמת Windows, ובקשות API בהמשך משתמשות ב־Bearer.

## תפעול, דואר ומחזור חיי IIS

אתחול רגיל עושה connect/ping ובדיקת schema/owner לקריאה בלבד. הוא אינו יוצר משתמשים, מבצע מיגרציה או יוצר אינדקסים. מסד ריק/מיגרציה פעילה גורמים לסירוב הפעלה מפורש. אינדקסים נוצרים בהחלה ידנית.

הדואר דורש worker פעיל: אם מפעילים JOBS_ENABLED, יש להגדיר Application Pool כ־AlwaysRunning, ביטול idle timeout, preload מאושר ובקשת warm-up פנימית ל־/api/health אחרי start/recycle. זהו worker שבתוך IISNode, לא שירות Windows. אם הארגון לא מאפשר תצורה זו, יש להשאיר תזכורות כבויות עד שימוש במנגנון warm-up/ניטור ארגוני קיים; אין הבטחה לשליחה ב־09:30 כשהיישום כבוי. התזכורת נתפסת בהפעלה באותו יום אחרי המועד, ולא נוצרות תזכורות חדשות על ימים קודמים שהמערכת הייתה כבויה.

תור Mongo עמיד עם מפתחות דה־דופליקציה, תביעה אטומית, workerId, lease לשתי דקות וחידוש כל 20 שניות. sending שהתיישן או שגיאת SMTP עם תוצאה לא ודאית הופכים ל־outcome_unknown, ולא נשלחים שוב אוטומטית. partial אינו נשלח שוב. בודקים ביומן SMTP לפי Message-ID לפני פעולה ידנית של DBA; אין הבטחת exactly-once. מסך דואר מציג גם תוצאה לא ידועה. כפתור ניסיון חוזר מיועד רק לfailed לפני מסירה/חוסר הגדרה/חוסר נמענים. מ־IIS יש לתת זמן עצירה של 60 שניות; עצירה מסודרת מסיימת בקשות ועבודה קיימת, ואז סוגרת Mongo. הריגה קשיחה נשענת על התאוששות lease.

## שדרוג, מיגרציה ושחזור

preflight טוען ובודק את כל רשומות המרחבים, התוכניות, האמצעים והמשתמשים; שם משתמש מנורמל לדומיין/sAMAccountName נבדק לכפילויות לפני כתיבה. כשל preflight אינו משנה מסד ואינו יוצר journal. apply דורש שם מסד מפורש, בודק שוב שהנתונים לא השתנו, יוצר גיבוי לפני/אחרי ונקודת התקדמות ב־migrationRuns/migrationRecords. אין תלות ב־replica set או transactions; אין למחוק את גיבויי המיגרציה לפני אישור שדרוג.

אחרי הפסקה ב־apply, היישום מסרב לעלות אם journal פעיל. כאשר ההחלה התחילה ויש runId, עוצרים את היישום ומריצים:

```powershell
$env:CONFIRM_MIGRATION_DATABASE='makam'
& 'C:\Approved\Node\node.exe' .\scripts\migrate.js resume 'RUN_ID'
& 'C:\Approved\Node\node.exe' .\scripts\migrate.js verify
```

להחזרת הרשומות שעברו מיגרציה (users/bases ו־rooms/settings של כל בסיס) מהגיבוי, כשהיישום עצור בלבד:

```powershell
& 'C:\Approved\Node\node.exe' .\scripts\migrate.js restore 'RUN_ID'
```

השחזור מחזיר אותן במדויק, גם מזהים, היסטוריה והרשאות; סכמה ישנה לא תעלה ביישום החדש. במקרה rollback לפריסה קודמת, מחזירים SERVER וFRONT יחד ואת התצורה המתאימה. אם היו כתיבות עסקיות אחרי השדרוג, שחזור מיגרציה ימחוק אותן באוספים האלה: משתמשים בגיבוי ארגוני מלא ובתוכנית שחזור מאושרת, לא בrestore עיוור. אין להריץ restore מול תעבורת משתמשים פעילה. לבחירת runId שנקטע משתמשים ב־migrationRuns, מסמך `_id:active`. יש להגן על אוספי הגיבוי בהרשאות DBA ולא לחשוף דרך API.

## בדיקות קבלה בסביבת הארגון

הריצו Inspect-Target.ps1 לקריאה בלבד והצליבו את Node המדויק עם דרישות החבילה. אחרי הגדרה ב־staging, Target-Smoke.ps1 בודק health, קבצים רגישים, preflight אנונימי, header מזויף ואימות Windows של המשתמש המחובר; הוא אינו מדפיס token.

```powershell
.\Inspect-Target.ps1 -IisApplication 'SiteName/makam' -ApprovedNodePath 'C:\Approved\Node\node.exe'
.\Target-Smoke.ps1 -ApiBaseUrl 'https://api.internal/makam/api' -SharePointOrigin 'https://sp.internal' -BaseId 'PERMITTED_BASE_UUID'
```

בנוסף, דרך SharePoint ובמסד staging בלבד: התחברו עם כל שש הרמות, נסו מרחב לא מורשה ושינוי role ידני, בטלו הרשאה ובדקו שsession נדחה. בצעו יצירה/עריכה של מרחב ואמצעים, ארכוב ושחזור, בדיקה מלאה וממוקדת, פתיחת/סגירת פער, בקשה ואישור, שרטוט, תמונה/מיקומים, PUT/PATCH/DELETE, Excel וPNG. השוו קריאה אחרי כתיבה ולאחר recycle. בשני דפדפנים ערכו אותה מפה; העדכון השני חייב לקבל 409, הטיוטה להישמר וטעינה מחדש להיות מפורשת. ודאו כל מצב בהיר/כהה ו־RTL. ערכי זמן מתורגמים ל־Asia/Jerusalem עם 24 שעות גם כשהמחשב באזור זמן שונה.

בצעו cold start, recycle Application Pool בפקודת DevOps המקובלת ליישום זה בלבד, המתינו לwarm-up ואז חזרו על health והזדהות. אין צורך בterminal או בשירות Node נוסף. בדקו תור SMTP אחרי interruption בלי לשלוח הודעה כפולה. תעדו PASS/FAIL/NOT RUN לכל שורה ב־TARGET-CHECKLIST.md; רק דו״ח זה יכול לסגור את שער הייצור.

## מידור וניהול מרובה בסיסים

רק בעלים ומנהל מערכת פיקודי מקבלים תמונת מצב פיקודית ויכולים ליצור, למחוק ולשחזר בסיסים ולמנות מנהלי בסיסים. רק הבעלים ממנה מנהל מערכת פיקודי. מנהל בסיס מנהל רק את משתמשי הבסיסים שהוקצו לו, ואינו נחשף להרשאות אחרות של משתמש שהוסיף. הוספה מקומית היא פעולה ממודרת גם כשאותו sAMAccountName קיים בבסיס אחר. אין הקצאת הרשאות אוטומטית מ־AD.

כל בקשת בסיס נושאת X-Base-Id; השרת בודק את הזכות מחדש ומפעיל namespace נפרד לכל מרחבים, אמצעים, מפות, תיעוד ותור דואר. GET /api/bases מחזיר רק בסיסים מורשים. למשתמש של בסיס אחד אין בורר; לכמה בסיסים מוצג בורר מינימלי. מעבר בסיס יוצר מחדש את מסכי העריכה כדי למנוע שמירת טיוטה בבסיס אחר. זהות והרשאות נקראות מחדש בכל בקשה, לרבות session שנוצר לפני שינוי הרשאה.

המיגרציה סורקת את קטלוג bases ואת כל אוספי rooms/settings עם הקידומת השמורה של כל בסיס, כולל בסיס שהועבר לארכיון. מזהי בסיסים וקידומות קיימים אינם מוחלפים; בסיס מקורי ממשיך להשתמש באוספים ללא קידומת. baseIds ו־baseGrants נשמרים, וגם הרשאות שונות לאותו אדם בשני בסיסים. נוסף סימון iisnodeMultibaseSchema=1 בכל הגדרת בסיס. השחזור מחזיר גם את הקטלוג והקצאות הבסיסים. media, adminAudit, mailOutbox ו־commandSnapshots קיימים אינם מועתקים או נמחקים במיגרציה. גבו את כל המסד לפני ההחלה.

במסד חדש בלבד, m9267680 נוצר כבעלים ו־c9812933 כמנהל הבסיס המקורי. בשדרוג מסד קיים נשמרים התפקידים שהוקצו בו — משתני bootstrap אינם עוקפים אותם. הדומיין ARMY מאומת בשרת; בכתיבת הרשאה משתמשים ב־sAMAccountName בלבד.

תמונת מצב פיקודית מחושבת בשרת; היא כוללת בסיסים פעילים, כשירות משוקללת לפי אמצעים, SLA, חריגות בדיקה, מגמות, פירוט ממודר, Excel ותמונה לשקופית. מנהל מקומי מקבל 403, גם דרך בקשה ידנית. בקשת פירוט בסיס נבדקת שוב. דואר מופעל בנפרד בהקשר כל בסיס, עם נמענים לפי הרשאה אפקטיבית וקישור makamBase. אין שליחה מבסיס שנמחק.

בדיקות הקבלה חייבות לכלול שני בסיסים, מנהל מקומי לכל אחד, משתמש בעל תפקידים שונים ביניהם, שינוי X-Base-Id ידני, פירוט/Excel/PNG פיקודיים, תצ״א שונה, ביטול הרשאה ושינוי בסיס במהלך עריכה.

## כניסה וההבדל בין SharePoint לבין אימות זהות

SharePoint מארח את FRONT ומפעיל את מנגנון העמוד המאושר. JavaScript שקורא CurrentUser אינו הוכחה לשרת מי המשתמש, גם אם SharePoint עצמו מאמת אותו. בגרסת IISNode זו חשבון Windows מאומת בכניסת IIS הייעודית וממופה ל־sAMAccountName. אין העברת שם מהדפדפן כתחליף לאימות. אם צוות DevOps אינו יכול לספק או להוכיח את Windows Authentication והקידום המוגן של AUTH_USER/AUTH_TYPE, הגישה בייצור נשארת חסומה. אין שירות proof או רכיב חווה חדש בחבילת ברירת המחדל.
