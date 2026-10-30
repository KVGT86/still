import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
import { blankState } from "../shared/domain.mjs";
test("service isolates accounts, protects PIN data, merges changes and confirms deletes", async () => {
  const { app, close } = createApp({
    verifyAccount: async (key) => {
      if (!["alice", "bob"].includes(key)) throw Error();
      return key;
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, body, token = "", unlock = "") => {
    const r = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Profile-Token": unlock,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  try {
    const health = await fetch(base + "/health");
    assert.equal(health.headers.get("x-frame-options"), "DENY");
    assert.equal(health.headers.get("referrer-policy"), "no-referrer");
    assert.match(
      health.headers.get("content-security-policy"),
      /script-src 'self'/,
    );
    assert.equal((await call("/profiles")).status, 401);
    const a = (await call("/session", { authKey: "alice" })).data.token,
      b = (await call("/session", { authKey: "bob" })).data.token;
    const imported = blankState();
    imported.saved.x = {
      meta: { id: "x", type: "movie", name: "X" },
      updatedAt: Date.now(),
    };
    const p = (
      await call(
        "/profiles",
        { name: "Private", pin: "1234", importState: imported },
        a,
      )
    ).data;
    assert.equal(p.locked, true);
    assert.equal(p.pin, undefined);
    assert.equal((await call("/profiles", undefined, b)).data.length, 0);
    assert.equal(
      (await call(`/profiles/${p.id}/state`, undefined, b)).status,
      404,
    );
    assert.equal(
      (await call(`/profiles/${p.id}/state`, undefined, a)).status,
      403,
    );
    assert.equal(
      (await call(`/profiles/${p.id}/unlock`, { pin: "0000" }, a)).status,
      403,
    );
    const u = (await call(`/profiles/${p.id}/unlock`, { pin: "1234" }, a)).data;
    assert.ok(u.state.saved.x);
    const state = (await call(`/profiles/${p.id}/state`, undefined, a, u.token))
      .data;
    assert.ok(state.saved.x);
    assert.equal(
      (await call(`/profiles/${p.id}/state`, { bad: true }, a, u.token)).status,
      400,
    );
    state.saved.y = {
      meta: { id: "y", type: "movie", name: "Y" },
      updatedAt: Date.now(),
    };
    assert.ok(
      (await call(`/profiles/${p.id}/state`, state, a, u.token)).data.saved.y,
    );
    assert.equal(
      (await call(`/profiles/${p.id}/delete`, {}, a, u.token)).status,
      400,
    );
    assert.equal(
      (await call(`/profiles/${p.id}/delete`, { confirm: true }, a, u.token))
        .status,
      200,
    );
    assert.equal((await call("/profiles", undefined, a)).data.length, 0);
    assert.equal((await call("/session/revoke", {}, a)).status, 200);
    assert.equal((await call("/profiles", undefined, a)).status, 401);
  } finally {
    await new Promise((r) => server.close(r));
    close();
  }
});
