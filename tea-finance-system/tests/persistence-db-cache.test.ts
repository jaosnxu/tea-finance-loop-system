import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const runtimeDir = path.join(process.cwd(), "data", "runtime");
const cachePath = path.join(runtimeDir, "config-db-cache.json");

function cleanupCache() {
  if (existsSync(cachePath)) {
    rmSync(cachePath);
  }
}

test("readDatabaseConfigCache returns null when cache is absent", async () => {
  cleanupCache();
  const mod = await import(`../lib/persistence-db.ts?case=missing-${Date.now()}`);
  assert.equal(mod.readDatabaseConfigCache(), null);
});

test("readDatabaseConfigCache returns parsed snapshot when cache exists", async () => {
  mkdirSync(runtimeDir, { recursive: true });
  const fixture = {
    organizations: [{ id: "org-1", displayName: "Test Org" }],
    approvalFlowTemplates: [{ id: "flow-1", name: "Flow" }],
    paymentRequestFormTemplate: { id: "form-1", name: "Form", sections: [], fields: [] },
    bankAccounts: [{ id: "ba-1", accountName: "Main Account" }],
    exchangeRates: [{ id: "fx-1", fromCurrency: "USD", toCurrency: "RUB", rate: 90 }],
    ledgerAccountMappings: [{ id: "lam-1", accountCode: "6601", accountName: "Expense" }],
    paymentParties: [{ id: "pp-1", name: "Vendor" }]
  };
  writeFileSync(cachePath, JSON.stringify(fixture, null, 2), "utf-8");

  const mod = await import(`../lib/persistence-db.ts?case=present-${Date.now()}`);
  const state = mod.readDatabaseConfigCache();
  assert.ok(state);
  assert.equal(state?.organizations[0]?.displayName, "Test Org");
  assert.equal(state?.paymentRequestFormTemplate?.name, "Form");
  assert.equal(state?.paymentParties[0]?.name, "Vendor");

  cleanupCache();
});
