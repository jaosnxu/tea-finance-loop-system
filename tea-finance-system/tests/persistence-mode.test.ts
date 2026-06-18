import test from "node:test";
import assert from "node:assert/strict";

test("persistence mode defaults to runtime_json", async () => {
  delete process.env.TEA_FINANCE_PERSISTENCE_MODE;
  const mod = await import(`../lib/persistence.ts?case=default-${Date.now()}`);
  assert.equal(mod.getPersistenceMode(), "runtime_json");
  assert.equal(mod.isDatabasePersistenceEnabled(), false);
});

test("persistence mode respects database env", async () => {
  process.env.TEA_FINANCE_PERSISTENCE_MODE = "database";
  const mod = await import(`../lib/persistence.ts?case=db-${Date.now()}`);
  assert.equal(mod.getPersistenceMode(), "database");
  assert.equal(mod.isDatabasePersistenceEnabled(), true);
  delete process.env.TEA_FINANCE_PERSISTENCE_MODE;
});
