(async function () {
  "use strict";
  const script = document.currentScript;
  const folder = new URL("./", script.src);
  const host = document.createElement("div");
  host.setAttribute("dir", "rtl");
  host.setAttribute("role", "region");
  host.setAttribute("aria-label", "מכ״ם — מערכת כשירות מרחבית");
  script.insertAdjacentElement("afterend", host);
  try {
    if (folder.origin !== location.origin)
      throw new Error("יש לטעון את קובצי הממשק מאותו אתר SharePoint");
    const response = await fetch(new URL("index.html", folder), {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error("לא ניתן לטעון את קובצי הממשק מספריית SharePoint");
    const doc = new DOMParser().parseFromString(
      await response.text(),
      "text/html",
    );
    if (!doc.getElementById("root")) throw new Error("קובץ הממשק אינו תקין");
    const base = doc.createElement("base");
    base.href = folder.href;
    doc.head.prepend(base);
    const frame = document.createElement("iframe");
    frame.title = "מכ״ם — מערכת כשירות מרחבית";
    frame.style.cssText =
      "display:block;width:100%;height:calc(100vh - 110px);min-height:560px;border:0;";
    // srcdoc inherits SharePoint's origin; the entire UI and assets come from its library.
    // Do not sandbox to an opaque origin: that would remove authenticated access to SharePoint REST.
    frame.srcdoc = "<!doctype html>" + doc.documentElement.outerHTML;
    host.replaceChildren(frame);
  } catch (error) {
    host.textContent = error.message;
    host.setAttribute("role", "alert");
  }
})();
