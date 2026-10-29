import { test } from "node:test";
import assert from "node:assert/strict";
import { Resvg } from "@resvg/resvg-js";
import { appIconSvg, icon } from "../scripts/shared-icon.mjs";
test("shared squircle icon renders at every platform size with transparent corners", () => {
  for (const size of [16, 32, 48, 128, 130, 192, 256, 512]) {
    const png = icon(size);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  const image = new Resvg(appIconSvg, {
    fitTo: { mode: "width", value: 512 },
  }).render();
  const pixels = image.pixels;
  assert.equal(pixels[3], 0);
  assert.equal(pixels[(256 * 512 + 256) * 4 + 3], 255);
});
