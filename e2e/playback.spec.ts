import { test, expect } from "@playwright/test";

test("LG selects original torrent media and retains explicit HLS compatibility", async ({
  page,
}) => {
  await page.goto("http://localhost:5173");
  const urls = await page.evaluate(async () => {
    const modulePath = "/src/api.ts";
    const api = await import(modulePath);
    Object.defineProperty(window, "webOSSystem", {
      value: {},
      configurable: true,
    });
    const source = {
      infoHash: "0123456789abcdef0123456789abcdef01234567",
      fileIdx: 0,
    };
    const direct = await api.resolvePlayUrl(source, "http://engine.test:11470");
    const fallback = await api.resolvePlayUrl(
      source,
      "http://engine.test:11470",
      true,
    );
    delete (window as any).webOSSystem;
    const desktop = await api.resolvePlayUrl(
      source,
      "http://engine.test:11470",
    );
    return { direct, fallback, desktop };
  });
  expect(new URL(urls.direct).pathname).toBe(
    "/0123456789abcdef0123456789abcdef01234567/0",
  );
  expect(new URL(urls.fallback).pathname).toMatch(/^\/hlsv2\/.+\/master.m3u8$/);
  expect(new URL(urls.fallback).searchParams.get("mediaURL")).toBe(urls.direct);
  expect(new URL(urls.desktop).pathname).toContain("/hlsv2/");
});

test("cancelled source search aborts the underlying fetch", async ({
  page,
}) => {
  await page.goto("http://localhost:5173");
  const aborted = await page.evaluate(async () => {
    const modulePath = "/src/api.ts";
    const api = await import(modulePath);
    let sawAbort = false;
    const original = window.fetch;
    window.fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init!.signal!.addEventListener("abort", () => {
          sawAbort = true;
          reject(new DOMException("Cancelled", "AbortError"));
        });
      });
    try {
      const controller = new AbortController();
      const pending = api.streams(
        [
          {
            transportUrl: "https://fixture.test/manifest.json",
            manifest: { resources: ["stream"] },
          },
        ],
        "movie",
        "fixture",
        controller.signal,
      );
      controller.abort();
      await pending;
      return sawAbort;
    } finally {
      window.fetch = original;
    }
  });
  expect(aborted).toBe(true);
});
