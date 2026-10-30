import { ensureEngine } from "../desktop/engine-install.cjs";
const directory = await ensureEngine(
  process.argv[2] || "tools",
  process.env.STILL_ENGINE_ARCHIVE,
);
console.log(directory);
