# שער קבלה ארגוני — למילוי DevOps

ברירת המחדל לכל בדיקה: **NOT RUN**. תוצאה של בדיקת Node מקומית/HTTP/סימולציית כותרות אינה PASS של IIS.

|בדיקה|תוצאה|עדות/מועד/מבצע|
|---|---|---|
|Node המאושר, ארכיטקטורה, NAPI ו־IISNode; התאמת Sharp בחבילה|NOT RUN||
|Node process מוגדר בנתיב מלא, ללא ARR/שירות נפרד|NOT RUN||
|cold start ו־health כולל חיבור מסד קיים|NOT RUN||
|session.js דורש Windows; AUTH_USER/AUTH_TYPE מאומתים|NOT RUN||
|header מזויף במקפים/קו תחתון/כפולים נדחה|NOT RUN||
|חשיפת .env*, sources, package, node_modules, logs, backups, .git נדחית|NOT RUN||
|OPTIONS בלי Windows challenge; origins אסורים נדחים|NOT RUN||
|טעינת nested SharePoint JS/CSS/font/logo/runtime-config|NOT RUN||
|בדיקות browser אמיתיות עם זהות ו־RBAC בכל הרמות|NOT RUN||
|PUT/PATCH/DELETE, תמונה, Excel וPNG בstaging|NOT RUN||
|מידור מרחבים ושינוי/ביטול משתמש/session|NOT RUN||
|בדיקות מלאות/ממוקדות, פערים, בקשות, ארכוב, שרטוט, תיעוד|NOT RUN||
|התנגשות מפה משני דפדפנים וטיוטה שלא נמחקת|NOT RUN||
|RTL, Dark/Light ו24 שעות|NOT RUN||
|recycle/warm-up; נתונים נשמרים וזיהוי מתחדש|NOT RUN||
|SMTP פנימי, partial/unknown ואי־שליחה עיוורת אחרי restart|NOT RUN||
|גיבוי, preflight/apply/verify ותרגול rollback מבודד|NOT RUN||

|מידור בין שני בסיסים, שינוי X-Base-Id ופירוט פיקודי ידני|NOT RUN||
|שש רמות; משתמש בתפקידים שונים; מנהל מקומי אינו רואה הרשאות אחרות|NOT RUN||
|תצ״א נפרדות, החלפת בסיס ובורר מוסתר למשתמש של בסיס יחיד|NOT RUN||
|Excel/PNG פיקודיים כוללים רק בסיסים מורשים|NOT RUN||
|מיגרציה/rollback לכל namespaces עם baseGrants וקטלוג קיימים|NOT RUN||

אין לסמן TRUSTED_IDENTITY_VERIFIED בייצור על סמך שם המשתמש שמופיע ב־SharePoint בלבד.
