# אימות המסירה מרובת הבסיסים 3.1.0

החבילה הקיימת ../../delivery/Makam-SharePoint-MultiBase-20260919 מתעדכנת באותו מקום; מקור נקי בענף remediation/iisnode-multibase-20261006. baseline a22b4e12f100227af755cbea150948cda1d1b9f8.

FRONT מכיל React סטטי ונכסים מקומיים; SERVER מכיל CommonJS/IISNode, web.config ותלויות production נעולות; GUIDE כולל מסירה, התקנה, מיגרציה ובדיקות קבלה בעברית. SOURCE נוסף באותה חבילה וכולל Git bundle מלא, מקור ZIP ו־source.json המקושרים ל־sourceCommit. SOURCE אינו מיועד לפרסום. אין Node או Mongo בינאריים, מסדי נתונים או .env אמיתי; קוד legacy קיים במקור למבחני רגרסיה בלבד ואינו ב־SERVER.

manifest.json כולל sourceCommit, גרסה, baselineCommit, expectations ו־SHA-256 לכל קובץ. הארכיון לצד התיקייה: Makam-SharePoint-MultiBase-20260919.zip; הגיבובים: Makam-SharePoint-MultiBase-20260919.sha256.txt; תוצאות: Makam-SharePoint-MultiBase-20260919.release-report.json ו־acceptance-local.json. ה־hash נשמר מחוץ ל־ZIP כדי למנוע מעגל חישוב.

בדיקת החבילה המחולצת (מסדי readiness_test_* בלבד):

```powershell
node scripts/verify-release.mjs .verification/extracted-release
$env:MAKAM_TEST_SERVER_ROOT=(Resolve-Path .verification/extracted-release/SERVER).Path
node --test tests/api.test.mjs tests/multibase.test.mjs
Remove-Item Env:MAKAM_TEST_SERVER_ROOT
$env:MAKAM_TEST_RELEASE_ROOT=(Resolve-Path .verification/extracted-release).Path
node --test tests/browser.test.mjs
Remove-Item Env:MAKAM_TEST_RELEASE_ROOT
```

עדכון 07.10: `REPRODUCING.he.md` כולל פקודות clone/install/tests/build/package; `scripts/fresh-checkout.mjs` משחזר מ־Git bundle המסירה לעץ חדש ומשווה את כל קובצי payload ואת manifest. נרמול LF נעשה לפני hash, ו־.gitattributes במסירה מונע שינוי שקט ב־Git. תלויות ובינאריים לא מנורמלים. ZIP אינו מובטח זהה בבייטים עקב timestamps; גיבוב כל ארכיון נרשם בנפרד.

העדויות אינן נשארות מקומיות בלבד: `Makam-SharePoint-MultiBase-20260919.evidence.zip` לצד החבילה מכיל פלט גולמי ו־commands.json, צילומים, שחזור מעותק נקי ו־evidence-manifest. מקור הבדיקות כלול ב־SOURCE. ה־commit והגיבובים בפועל נמצאים ב־release-report, sha256 ו־acceptance-local. IIS/SharePoint/SMTP הארגוניים: **BLOCKED — TARGET ENVIRONMENT REQUIRED**. Chromium המקומי הוא סימולציה של ספריית SharePoint, אינו בדיקת חווה.
