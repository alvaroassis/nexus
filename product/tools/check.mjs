import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../",import.meta.url));
let failed = false;
for (const folder of ["web","tools","test"]) {
  for (const file of await readdir(path.join(root,folder))) {
    if (!file.endsWith(".mjs")) continue;
    const result = spawnSync(process.execPath,["--check",path.join(root,folder,file)],{encoding:"utf8"});
    if (result.status !== 0) { failed=true;process.stderr.write(result.stderr); }
  }
}
if (failed) process.exit(1);
process.stdout.write("All Nexus modules passed syntax checks.\n");
