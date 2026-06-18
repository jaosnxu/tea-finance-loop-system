export type PersistenceMode = "runtime_json" | "database";

export function getPersistenceMode(): PersistenceMode {
  const configured = process.env.TEA_FINANCE_PERSISTENCE_MODE?.trim().toLowerCase();
  if (configured === "database") {
    return "database";
  }
  return "runtime_json";
}

export function isDatabasePersistenceEnabled() {
  return getPersistenceMode() === "database";
}

export function getPersistenceModeLabel() {
  return isDatabasePersistenceEnabled() ? "数据库模式" : "运行时文件模式";
}
