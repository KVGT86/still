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
