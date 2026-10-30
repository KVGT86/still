import { readFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
export const appIconSvg = readFileSync(
  new URL("../src/assets/app-icon.svg", import.meta.url),
  "utf8",
);
export function icon(size) {
  return new Resvg(appIconSvg, { fitTo: { mode: "width", value: size } })
    .render()
    .asPng();
}
export function tvBanner() {
  const source = Buffer.from(appIconSvg).toString("base64");
  return new Resvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#f5f4f0"/><image href="data:image/svg+xml;base64,${source}" x="112" y="42" width="96" height="96"/></svg>`,
  )
    .render()
    .asPng();
}
