# מקור מלא ושחזור המסירה — מכ״ם מרובת בסיסים

המקור המחייב הוא הגרסה המקומית הרב־בסיסית. `SOURCE/makam-source.bundle` מכיל Git מלא עם ההיסטוריה; `makam-source.zip` הוא עותק המקור באותו commit ללא היסטוריה. `SOURCE/source.json` ו־manifest.json מציינים את אותו sourceCommit. React, צד השרת, shared, בדיקות, lockfiles וכלי הבנייה כלולים. אין תלות במאגר GitHub כדי לשחזר. המאגר החיצוני לא עודכן בעבודה זו.

SOURCE ו־GUIDE אינם מיועדים להעלאה לספריית SharePoint או לפרסום ב־IIS. העלו רק FRONT ל־SharePoint ורק SERVER ליישום ה־API כמפורט במדריך ההתקנה. אין לבצע npm או build בשרת הייצור.

## עמדת בנייה מורשית ונקייה

נדרשים Windows x64, Git, Node מאושר >=22.12, npm המתאים ל־Node, Chrome מאושר ו־MongoDB **לבדיקות בלבד** המאזין ב־127.0.0.1:27028. הבדיקות משתמשות במסדי readiness_test_* ומוחקות רק את מסדי הבדיקה שלהן. אין להפנות את הפורט לשירות ייצור. ניתן להכין מטמון npm ברשת מאושרת מראש ולהעבירו לרשת הסגורה; התקנה מאפס דורשת registry ארגוני או מטמון מלא התואם ל־lockfiles. זמן הריצה של המוצר אינו פונה לאינטרנט.

בנו את המבנה הבא בתיקיית עבודה חדשה שבחרתם. המסירה תיכתב **רק** ל־delivery באותו עץ; אין ליצור checkout מעל קוד או חבילה פעילים.

```powershell
git clone C:\handoff\SOURCE\makam-source.bundle C:\build\makam\variants\sharepoint-multibase
Set-Location C:\build\makam\variants\sharepoint-multibase
git rev-parse HEAD
git status --porcelain
npm ci --ignore-scripts --no-audit --no-fund --offline
# אם npm אינו נמצא לצד node.exe, הגדירו את הנתיב המאושר אל npm-cli.js:
$env:NPM_CLI_PATH='C:\approved-node\node_modules\npm\bin\npm-cli.js'
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:MAKAM_EVIDENCE_DIR=(Join-Path (Get-Location) '.verification\acceptance\source')
node scripts/verify-delta.mjs source
npm run package
node scripts/verify-release.mjs ../../delivery/Makam-SharePoint-MultiBase-20260919
```

כל הפקודות חייבות להסתיים ב־exit code 0. `verify-delta` מריץ lint, כל הבדיקות, build ו־Chrome אמיתי ושומר פלט גולמי, commands.json, תוצאות IPC וצילומי מסך. הבדיקות אינן מסתפקות בהצהרות במסמכי Markdown. התקנת תלויות חסרה אינה נחשבת PASS. להורדה מורשית בזמן הכנת עמדת הבנייה בלבד אפשר להשמיט `--offline` ב־npm ci ולהגדיר `PREPARE_DEPENDENCIES_ONLINE=true` לאריזה; אין לשנות את ה־lockfiles.

בדיקת שחזור אוטומטית מה־bundle שכבר נמצא במסירה: `node scripts/fresh-checkout.mjs`. ניתן להגדיר `MAKAM_FRESH_EVIDENCE_DIR` לתיקיית עדויות חדשה. הסקריפט יוצר checkout תחת workspace/variants, מתקין מהמטמון, מריץ את כל הבדיקות ובונה מחדש; הוא משווה bytes/hash לכל קובץ ו־manifest. אינו מוחק checkout קיים. איסוף העדויות לאחר בדיקת המקור והחילוץ: `node scripts/collect-evidence.mjs .verification/delta-20261007`. זה כלי מסירה לעמדת הבנייה; אינו מופעל בשרת הייצור.

## בדיקת הארכיון שנמסר

חלצו את ZIP המסירה לתיקייה חדשה, ללא שינוי בקבצים, ובדקו גם את התוצרים המחולצים:

```powershell
Expand-Archive ../../delivery/Makam-SharePoint-MultiBase-20260919.zip .verification/extracted
$env:MAKAM_EVIDENCE_DIR=(Join-Path (Get-Location) '.verification\acceptance\package')
node scripts/verify-delta.mjs package .verification/extracted
```

הריצה השנייה טוענת את SERVER ואת FRONT **מהחילוץ**, כולל תלויות השרת שבחבילה. קוד הבדיקה מגיע מהמקור המלא באותו commit. הבדיקות המקומיות מדמות SharePoint וקידום זהות IIS; הן אינן בדיקת החווה הארגונית.

## התאמת Git, בנייה ו־manifest

`.gitattributes` במקור מגדיר LF לקוד. האריזה מנרמלת את הטקסט שבבעלות המוצר אחרי הבנייה/העתקה ולפני חישוב manifest; תלויות ספק, תמונות וארכיונים נשמרים בבייטים המקוריים. `.gitattributes` בשורש המסירה מגן גם על העלאת FRONT/SERVER למאגר Git מסירה. אין לשנות תוצר אחרי manifest, ואין לנרמל node_modules.

לשחזור זהה נדרשים אותו commit, Windows x64, גרסאות Node/npm וה־lockfiles המתועדות ב־commands.json. משווים את נתיבי הקבצים, bytes ו־SHA-256 ב־manifest ואת SHA של manifest עצמו. ZIP יכול לקבל חותמות זמן שונות גם כאשר כל קובצי payload זהים; לכן SHA של כל ארכיון נרשם בנפרד. ZIP חדש אינו ה־7z הישן שנבדק על ידי DevOps.

לפני התאמה לסביבה מאמתים את manifest המקורי. הקבצים שצפויים להשתנות בפריסה: `FRONT/runtime-config.js` (כתובת HTTPS ציבורית בלבד), ו־`SERVER/web.config` רק אם יש override ארגוני מאושר. `SERVER/.env` חדש נוצר בשרת בלבד. הקליטו בדוח הפריסה נתיב, SHA-256 מקורי, SHA-256 לאחר התאמה, סיבת השינוי, מבצע ומועד; שמרו את ההגדרות והגיבובים בסביבה הארגונית המאובטחת. אין להחליף את manifest המקורי או למסור .env עם הראיות. שינוי בקובץ מוצר אחר מחייב בנייה/מסירה חדשה.

## שער ארגוני

**BLOCKED — TARGET ENVIRONMENT REQUIRED**. `TRUSTED_IDENTITY_VERIFIED=true` הוא שער תצורה, אינו עדות. רק DevOps יכולים לאשר את גבול הזיהוי באמצעות בדיקות היעד ב־DELTA-TARGET.he.md. אין להפעיל ייצור על סמך הצלחה מקומית.
