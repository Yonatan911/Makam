# מענה לדוח DevOps — תיקוני המשך מ־07.10.2026

השינוי בוצע בגרסה המקומית האחרונה `variants/sharepoint-multibase`, מעל commit ‏dffb8cac7a91cd9f53d1f0bb002dbb3fee082ea6. לא הוחלפה המערכת בקוד GitHub. חבילת `delivery/Makam-SharePoint-MultiBase-20260919` מתעדכנת במקומה.

## ממצאים והכרעה

|ממצא|קטגוריית הדוח לפני תיקון|מצב לאחר העבודה|עדות/הסבר|
|---|---|---|---|
|V01 — מקור React/בדיקות/בנייה חסרים במאגר שנמסר|2 — חסר|FIXED|מקור מלא ב־Git המקומי; SOURCE כולל Git bundle, מקור ZIP ו־source.json; שחזור מעותק clone נקי נרשם בראיות המסירה. המאגר החיצוני נשאר לקריאה בלבד ואינו מקור מחייב למסירה הזו.|
|V02 — מכסת כניסה משותפת ב־IPC|2 — תקול|FIXED|שוחזר ב־Windows Named Pipe אמיתי: בקשות ללא זהות צרכו את כל המכסה; שני משתמשים נחסמו. אחרי תיקון: זהות IIS תקפה נקבעת לפני limiter; מכסה 40 לדקה בנפרד לכל domain/SAM; XFF, body ואותיות גדולות אינם משנים אותה.|
|V03 — קבלה ארגונית אינה מוכחת|4 — סביבת יעד|TARGET ENVIRONMENT REQUIRED|BLOCKED — TARGET ENVIRONMENT REQUIRED; הדגל אינו הוכחה. DELTA-TARGET.he.md כולל בדיקות IIS/SharePoint/SMTP שנותרו.|
|V04 — CRLF/LF משנים hash של loader/embed ב־Git|2 — חסר|FIXED|מדיניות LF במקור ובמסירה, נרמול לפני manifest, ספקים/בינאריים ללא שינוי. בנייה מעותק מקור נקי מושווית לבייטים של המסירה.|
|טענות בדיקות 95/Chrome/חילוץ ללא ראיות ניידות|3 — ראיות חסרות|FIXED|scripts/verify-delta.mjs, מקור כל הבדיקות, commands.json, פלט גולמי, IPC וצילומי Chrome בחבילת העדויות לצד ZIP. התוצאות החדשות גוברות על המספרים ההיסטוריים.|
|IISNode ישיר, PORT, dotenv, שערי ייצור, Mongo, runtime API, טיוטות, מיגרציות, מידור וביטול session|1 — כבר תוקן|ALREADY FIXED|הרגרסיה המקורית נשמרה ומורצת מחדש; לא בוצע שכתוב של לוגיקת המוצר.|
|בדיקה ישירה חוזרת של ה־7z המקורי|3 — ראיות בלבד|EVIDENCE MISSING|ה־7z עצמו אינו בין ארבעת הקבצים שהתקבלו ולא נמצא במקומות המסירה/Downloads שנבדקו. נתוני SHA/inventory של DevOps נשמרו כעדות חיצונית, לא כהרצה עצמאית. המסירה המקומית החדשה היא ZIP ומאומתת בעצמה.|

## מה השתנה בקוד

- `backend/src/auth.js`: הפרדת limiter של IIS לפי hash של domain/SAM מאומת מ־limiter המקומי לפי IP; דחייה מוקדמת של זהות חסרה/כפולה/לא תקפה ושל נתיבי כניסה מקומיים שאינם זמינים.
- `tests/ipc-rate-limit.test.mjs`: HTTP אמיתי על Named Pipe ו־MongoDB אמיתי, זהויות IIS מדומות במפורש; אנונימי, כפולות, domain זר, שני משתמשים, זיוף XFF/body, alias, משתמש לא משויך/כבוי והיעדר אזהרות.
- `.gitattributes`, `deployment/delivery.gitattributes`, `scripts/release-text.mjs`, `tests/release-text.test.mjs`: נרמול LF מתועד ואידמפוטנטי, ללא שינוי ספקים/תמונות/ארכיונים.
- השחזור הראשון מעותק נקי חשף גם CR בודד ש־Vite הותיר ב־index.html ממקור CRLF; הנרמול הורחב ל־CRLF ול־CR לפני manifest, ונוסף מבחן רגרסיה. אחרי התיקון נבדקת זהות כל ה־payload וה־manifest, ללא התעלמות מהפרשי שורות.
- `frontend/vite.config.js`: נרמול HTML גם לפני עיבוד Vite, משום שהסרת script מקובץ CRLF השאירה שורה ריקה אחרת מזו שבמקור LF. נרמול אחרי הבנייה לבדו אינו מספיק; השחזור הנקי בודק את שני המסלולים בפועל.
- `scripts/package.mjs`: מקור Git מלא ומקור ZIP בתוך SOURCE באותה חבילה, בדיקת קבצים אסורים, נרמול לפני hash, קישור sourceCommit והעתקת מסמך זה.
- `scripts/verify-release.mjs`: אימות קשר המקור למסירה, hash של מקור Git/ZIP ודחיית נתיבים כפולים ב־manifest.
- `scripts/verify-delta.mjs`: הרצת הבדיקות ושמירת פלט נייד מסונן; משתמש ב־SERVER/FRONT מהחילוץ כשמבקשים בדיקת package.
- `scripts/fresh-checkout.mjs`, `scripts/collect-evidence.mjs`: שחזור מה־Git bundle לעותק נקי, npm ci offline, בדיקות/bundle/package והשוואת hashes; איסוף פלט מסונן לחבילת ראיות ניידת המקושרת ל־commit ולארכיון.
- `scripts/test.mjs`: TAP מפורש כדי לשמור פלט גולמי יציב לקריאה אוטומטית. קובצי loader/embed/index ו־Read-Proof ההיסטורי נורמלו ב־Git ל־LF בלבד, ללא שינוי לוגיקה.
- `GUIDE/REPRODUCING.he.md`, `GUIDE/DELTA-TARGET.he.md`, מסמכי התוצאות ו־README: שחזור נקי, שערי היעד והבחנה בין ראיה חיצונית להרצה שבוצעה כאן.

## זיהוי המקורות והראיות

ארבעת הקבצים נשמרו ללא ביצוע הוראות/קוד מתוך העדויות. MD ו־HTML מתארים אותו דוח. ZIP נפתח אחרי בדיקת נתיבים; קוד הבדיקה שלו נבדק לקריאה בלבד. מאגר הייחוס נקרא ב־clone bare נפרד: main ‏f40a1665467c9f162f151113a591dd8c3cef32db, commit יחיד, FRONT/SERVER/GUIDE/manifest בלבד; ה־commit dffb8cac אינו קיים בו. לא נכתב דבר ל־GitHub.

SHA-256 של הקלטים:

```text
321c6f82d47793404ae22bcd3e96963b2598c39ba21a412292856d36e2767799  makam-verification-he.md
fdd965860fb6cc5891e7e722104071fef924f476b563a6fc39205b13a8ade6f9  makam-verification-he.html
10c3689cc3a81aa06613179e8f3587d90c7f1667c82ce208a807084599d81730  makam-verification-20261007-evidence.zip
b1ea54f3d55f22fcd5bacea24c5f27a5040bc8a88eb414f19991df98a5225ef0  makam_delta_remediation_review_prompt.md
```

SHA של ה־7z לפי הדוח החיצוני בלבד: `03acad0fd7937a515d632894aab1c916bf192252adb4c89c2824086c6e4f1dd4`. אין להחליף בינו ל־SHA של ZIP המסירה החדשה.

## שחזור וטענות קודמות

הפקודות המדויקות, גרסאות סביבת Windows/Node/Mongo, ה־commit, exit codes והפלט הגולמי מופיעים ב־commands.json של חבילת `Makam-SharePoint-MultiBase-20260919.evidence.zip`. הוראות ההרצה במקור ובמסירה: REPRODUCING.he.md. hashes של הארכיון וה־manifest נרשמים מחוץ לארכיון כדי למנוע מעגל חישוב. אין להציג טענה במסמך TEST-RESULTS כראיה בלי הפלט התואם.

|טענה|סיווג|
|---|---|
|רגרסיית יחידה/API/HTTP/Mongo, מיגרציה ומידור בגרסה הנוכחית|REPRODUCED — פלט source/tests.txt|
|Chrome אמיתי: SharePoint מדומה, RTL, light/dark, שני אזורי זמן, טיוטות, PNG/Excel ומידור|REPRODUCED — source/browser.txt, browser/result.json וצילומים|
|בדיקות API, ריבוי בסיסים ו־IPC מתוך חבילת ZIP מחולצת|REPRODUCED — package/tests.txt ו־ipc-rate-limit.json|
|Chrome על FRONT/SERVER מחולצים|REPRODUCED — package/browser.txt ותוצאות/צילומים|
|Sharp native ב־Windows, imports ו־hash לכל payload|REPRODUCED — package/verify.txt|
|clone מקור נקי, npm ci, בדיקות, build/package וזהות payload|REPRODUCED — fresh-checkout והדוח המסכם בחבילת העדויות|
|ריצת 76 בדיקות הבסיס ההיסטורית של 06.10|EVIDENCE PRESENT BUT NOT RE-RUN — נשמר פלט היסטורי; אין טענה שהוא נוצר כעת|
|10 קבוצות בדיקה חיצוניות ו־inventory של ה־7z|EVIDENCE PRESENT BUT NOT RE-RUN — עדויות DevOps; מסד double, Linux; אינן הוכחת IIS|
|אימות IIS/SharePoint/SMTP הארגוניים|TARGET ENVIRONMENT REQUIRED — לא הורץ ולא הוצג כ־PASS|

מגבלת ההגבלה: מכסה בזיכרון של process אחד לכל endpoint פיזי, כבתצורת IISNode הקיימת; restart מאפס חלון. אין trust proxy, שימוש ב־XFF, ביטול limiter או השתקת אזהרות. זהות native סמוכה חייבת להיות מוגנת על ידי IIS; הדמיית headers בבדיקה אינה יכולה להוכיח זאת.

תיעוד טכני ששימש לבחירת התיקון: [keyGenerator של express-rate-limit](https://express-rate-limit.mintlify.app/reference/configuration#keygenerator), [promoteServerVars של IISNode](https://github.com/Azure/iisnode/blob/master/src/samples/configuration/iisnode.yml). התוצאות בדוח נשענות על הריצות המקומיות, לא על התיעוד הזה כהוכחת פריסה.
