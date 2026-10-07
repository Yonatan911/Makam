var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var stdin_exports = {};
__export(stdin_exports, {
  APP_DESCRIPTION: () => APP_DESCRIPTION,
  APP_NAME: () => APP_NAME
});
module.exports = __toCommonJS(stdin_exports);
const APP_NAME = '\u05DE\u05DB"\u05DD';
const APP_DESCRIPTION = "\u05DE\u05E2\u05E8\u05DB\u05EA \u05DB\u05E9\u05D9\u05E8\u05D5\u05EA \u05DE\u05E8\u05D7\u05D1\u05D9\u05EA";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  APP_DESCRIPTION,
  APP_NAME
});
