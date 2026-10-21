import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const dbPath = path.resolve(process.env.DATABASE_URL ?? "./data/app.db");

console.warn(`[reset] Menghapus database ${dbPath} …`);
for (const suffix of ["", "-wal", "-shm"]) {
  fs.rmSync(`${dbPath}${suffix}`, { force: true });
}

function run(args: string[]) {
  const result = spawnSync("npm", args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["run", "db:migrate"]);
run(["run", "db:seed"]);
console.info("[reset] Selesai.");
