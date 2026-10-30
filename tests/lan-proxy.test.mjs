import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { startLanProxy } from "../server/lan-proxy.mjs";
test("LAN proxy binds one address and preserves authentication, CORS and byte ranges", async () => {
  assert.throws(() => startLanProxy("0.0.0.0", 0));
  const upstream = http.createServer((req, res) => {
    assert.equal(req.headers.authorization, "Bearer fixture");
    assert.equal(req.headers.range, "bytes=2-4");
    res.writeHead(206, {
      "Access-Control-Allow-Origin": "null",
      "Content-Range": "bytes 2-4/8",
    });
    res.end("cde");
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const proxy = startLanProxy("127.0.0.1", 0, upstream.address().port);
  await once(proxy, "listening");
  try {
    assert.equal(proxy.address().address, "127.0.0.1");
    const response = await fetch(
      `http://127.0.0.1:${proxy.address().port}/fixture`,
      {
        headers: {
          Authorization: "Bearer fixture",
          Range: "bytes=2-4",
          Origin: "null",
        },
      },
    );
    assert.equal(response.status, 206);
    assert.equal(await response.text(), "cde");
    assert.equal(response.headers.get("access-control-allow-origin"), "null");
    assert.equal(response.headers.get("content-range"), "bytes 2-4/8");
  } finally {
    await new Promise((resolve) => proxy.close(resolve));
    await new Promise((resolve) => upstream.close(resolve));
  }
});
