"use strict";
const path = require("node:path");
function isEntrypoint(currentModule) {
  if (require.main === currentModule) return true;
  if (!process.argv[1]) return false;
  const normalize = (p) => {
    const value = path.resolve(p);
    return process.platform === "win32" ? value.toLowerCase() : value;
  };
  return normalize(process.argv[1]) === normalize(currentModule.filename);
}
exports.isEntrypoint = isEntrypoint;
