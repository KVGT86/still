import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { icon, tvBanner } from "./shared-icon.mjs";
await rm("android/app/src/main/assets/public", {
  recursive: true,
  force: true,
});
await mkdir("android/app/src/main/assets/public", { recursive: true });
await cp("dist", "android/app/src/main/assets/public", { recursive: true });
await mkdir("android/app/src/main/res/drawable", { recursive: true });
await writeFile("android/app/src/main/res/drawable/icon.png", icon(192));
await writeFile("android/app/src/main/res/drawable/banner.png", tvBanner());
console.log("Android assets ready. Run: cd android && ./gradlew assembleDebug");
