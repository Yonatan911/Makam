# מטריצת תיקון — הגרסה המקומית מרובת הבסיסים

מקור מחייב: variants/sharepoint-multibase. snapshot: a22b4e12f100227af755cbea150948cda1d1b9f8. ענף: remediation/iisnode-multibase-20261006. 76/76 בדיקות בסיס עברו לפני השינוי. אין החלפה ב־MeniViner/makam.

|נושא|עדות במקור המקומי|יישום|בדיקה/מצב|
|---|---|---|---|
|אירוח|deployment/iis ו־service דורשים proxy/service|IISNode ישיר, CommonJS, web.config|interceptor/bootstrap/Named Pipe PASS; IIS ארגוני NOT RUN|
|PORT|server/app.mjs ממיר לערך מספרי|שמירת pipe ללא host|listener Windows אמיתי PASS|
|תצורה|dotenv/cwd וברירות מחדל מקומיות|config יחיד, קדימות host, fail fast בייצור|remediation.test PASS|
|מקור React|src ומספר תוצרי build|frontend יחיד, runtime ציבורי, build אחד|lint/build/runtime/browser PASS|
|שגיאות API|JSON ישיר ומסלולי binaries נפרדים|client אחיד, סטטוס, HTML detection, ללא replay|frontend-runtime/browser PASS|
|מפות וטיוטות|ViewsV2 מעלה גרסה של draft בעקבות refresh|draft+version משותפים, conflict וreload מפורש|שני דפדפנים PASS|
|מיגרציה|database/initializeBases כותבים בעת startup|preflight קריאה בלבד; apply/resume/restore מפורשים לכל namespace|migration/remediation/multibase-migration PASS|
|ריבוי בסיסים|tenancy/base-access/access-routes המקומיים|נשמרו; אימות raw users לפני tenancy; X-Base-Id בכל client|כל 13 תרחישי multibase המקוריים PASS|
|הרשאות ממודרות|שש רמות ו־baseGrants|נשמרו; blind local add, global appointment, revocation מיידי|multibase/API/browser PASS|
|תמונת מצב פיקודית|CommandOverview והאגרגציה המקומיים|נשמרו, detail/export בשרת והרשאת global|command-overview/multibase/browser PASS|
|SMTP|תור מקומי לכל בסיס ללא lease|claims וlease עמידים; worker נפרד לכל בסיס; unknown/partial ללא resend|migration-mail/remediation/multibase PASS; SMTP ארגוני NOT RUN|
|זהות|proof/Read-Proof.ps1|native Windows session ב־IIS; legacy מבודד לבדיקות|forgery/revocation/CORS simulation PASS; גבול אמון ארגוני NOT RUN|
|קבצים פנימיים|IsFile bypass מסוכן|חסימת קבצים וrouting רק API/session|HTTP וweb.config PASS; IIS אמיתי NOT RUN|
|offline|אריזות מעורבות/runtime מקומי|allowlist של FRONT/SERVER/GUIDE; production closure; SHA-256|verify-release וחילוץ לפי RELEASE-RESULTS|

החסם החיצוני היחיד: דוח קבלה של DevOps מסביבת היעד הכולל Node/IISNode המאושרים, Windows Authentication וקידום native מוגן, טעינה אמיתית מ־SharePoint, recycle ו־SMTP. אין טענה למוכנות ייצור לפני מעבר השער.

תשתית ההטמעה הותאמה מתיקון התשתית הקודם ב־remediation/makam; הקוד העסקי נלקח מהגרסה המקומית. פרויקטי ייחוס שנקראו בלבד בעבודה הקודמת: marcol master 81af0ca16c6e165a46b54f638f1c9081c122cc1d; site-release-manager main ef5912068e3d9bf4ef35c616973dffd966f7cf76; site-builder main 706864f5425261f7167a1640bfd345e25dffa36e. אינם מקור לגרסת המוצר המקומית.
