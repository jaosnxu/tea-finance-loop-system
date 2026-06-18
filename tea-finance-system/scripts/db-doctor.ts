import { existsSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const schemaPath = path.join(projectRoot, "prisma", "schema.prisma");
const migrationPath = path.join(projectRoot, "prisma", "migrations", "20260614_init", "migration.sql");

const databaseUrl = process.env.DATABASE_URL?.trim();
const persistenceMode = process.env.TEA_FINANCE_PERSISTENCE_MODE?.trim() || "runtime_json";

const checks = [
  {
    label: "schema.prisma",
    ok: existsSync(schemaPath),
    detail: schemaPath,
  },
  {
    label: "init migration",
    ok: existsSync(migrationPath),
    detail: migrationPath,
  },
  {
    label: "DATABASE_URL",
    ok: Boolean(databaseUrl),
    detail: databaseUrl ? "已设置" : "未设置",
  },
  {
    label: "TEA_FINANCE_PERSISTENCE_MODE",
    ok: persistenceMode === "database",
    detail: persistenceMode,
  },
];

for (const check of checks) {
  const prefix = check.ok ? "OK" : "MISSING";
  console.log(`${prefix}  ${check.label}: ${check.detail}`);
}

const failed = checks.filter((check) => !check.ok);

if (failed.length > 0) {
  console.error("\n数据库初始化前检查未通过。先补齐缺失项，再执行 db:init。");
  process.exit(1);
}

console.log("\n数据库初始化前检查通过，可以继续执行 db:init。");
