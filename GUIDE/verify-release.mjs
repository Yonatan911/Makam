import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
export async function verifyRelease(target) {
  const manifest = JSON.parse(
    await fs.readFile(path.join(target, "manifest.json"), "utf8"),
  );
  if (manifest.schemaVersion !== 1 || !manifest.files.length)
    throw new Error("Invalid release manifest");
  const expected = new Map(manifest.files.map((f) => [f.path, f]));
  const found = [];
  async function walk(dir) {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name),
        relative = path.relative(target, p).split(path.sep).join("/");
      if (e.isSymbolicLink()) throw new Error("Release link forbidden");
      if (e.isDirectory()) await walk(p);
      else if (relative !== "manifest.json") found.push(relative);
    }
  }
  await walk(target);
  if (found.length !== expected.size)
    throw new Error("Unmanifested/missing file");
  for (const relative of found) {
    if (
      relative.startsWith("SERVER/runtime/") ||
      !expected.has(relative) ||
      /(^|\/)(\.env(?!\.example$)[^/]*|\.git|\.runtime|\.verification|logs?|backups?|sessions?|legacy)(\/|$)/i.test(
        relative,
      )
    )
      throw new Error("Forbidden/unexpected release file: " + relative);
    const data = await fs.readFile(path.join(target, relative)),
      record = expected.get(relative);
    if (
      data.length !== record.bytes ||
      createHash("sha256").update(data).digest("hex") !== record.sha256
    )
      throw new Error("Hash mismatch: " + relative);
  }
  const lock = JSON.parse(
    await fs.readFile(path.join(target, "SERVER/package-lock.json"), "utf8"),
  );
  if (
    Object.values(lock.packages).some(
      (p) => p.link || p.resolved?.startsWith("file:"),
    )
  )
    throw new Error("Local dependency in server closure");
  for (const name of ["react", "react-dom", "vite", "esbuild", "eslint"])
    if (
      await fs
        .stat(path.join(target, "SERVER/node_modules", name))
        .catch(() => null)
    )
      throw new Error("Development/frontend dependency in SERVER: " + name);
  const localRequire = createRequire(path.join(target, "SERVER/package.json"));
  const { createApp } = localRequire("./src/app.js"),
    { startServer } = localRequire("./src/server.js");
  if (typeof createApp !== "function" || typeof startServer !== "function")
    throw new Error("Invalid packaged entry exports");
  const sharp = localRequire("sharp");
  await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer();
  const html = await fs.readFile(path.join(target, "FRONT/index.html"), "utf8");
  if (!html.includes('dir="rtl"') || !html.includes("./runtime-config.js"))
    throw new Error("Invalid nested frontend bootstrap");
  for (const match of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)) {
    await fs.access(path.join(target, "FRONT", match[1]));
  }
  if (/(?:src|href)="(?:https?:)?\/\/|(?:src|href)="\/[^/]/.test(html))
    throw new Error("Frontend has external/root-relative asset");
  console.log(
    JSON.stringify({
      release: manifest.releaseVersion,
      files: found.length,
      hashes: "PASS",
      packagedImports: "PASS",
      nativeSharp: sharp.versions.vips,
      platform: process.platform,
      node: process.version,
      targetIIS: "NOT RUN",
    }),
  );
  return manifest;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const target = path.resolve(
    process.argv[2] || "../../delivery/Makam-SharePoint-MultiBase-20260919",
  );
  await verifyRelease(target);
}
