import test from "node:test";
import assert from "node:assert/strict";
import { recoveryBudget } from "../shared/playback.mjs";

test("recovery is bounded across alternating failures and fresh per source", () => {
  const retry = recoveryBudget();
  assert.deepEqual(retry("networkError"), { action: "network", delay: 1000 });
  assert.equal(retry("mediaError").action, "media");
  assert.deepEqual(retry("networkError"), { action: "network", delay: 2000 });
  assert.equal(retry("networkError").action, "fail");
  assert.equal(retry("mediaError").action, "fail");
  assert.equal(retry("otherError").action, "fail");
  assert.equal(recoveryBudget()("networkError").action, "network");
});
