import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoplayAllowed,
  blankState,
  continueItems,
  recordProgress,
  rankSources,
  changedMetas,
  mergeState,
  recommend,
} from "../shared/domain.mjs";
const meta = {
  id: "series",
  type: "series",
  name: "Example",
  genres: ["Drama"],
  videos: [
    { id: "e1", season: 1, episode: 1 },
    { id: "e2", season: 1, episode: 2 },
    { id: "e3", season: 1, episode: 3, released: "2999-01-01" },
  ],
};
test("scheduled autoplay checks the 07:00 and 22:00 boundaries", () => {
  for (const [h, expected] of [
    [6, false],
    [7, true],
    [21, true],
    [22, false],
  ])
    assert.equal(
      autoplayAllowed("scheduled", new Date(2026, 0, 1, h)),
      expected,
    );
  assert.equal(autoplayAllowed("on", new Date(2026, 0, 1, 23)), true);
  assert.equal(autoplayAllowed("off"), false);
});
test("automatic ranking ignores language gaps, needs a known resolution and prefers healthy swarms", () => {
  const streams = [
    { key: "4k-thin", quality: 2160, languages: ["en"], seeders: 3 },
    { key: "1080-big", quality: 1080, languages: ["en"], seeders: 800 },
    { key: "720-big", quality: 720, languages: ["en"], seeders: 500 },
    { key: "untagged", title: "1080p WEB-DL 👤 900" },
    { key: "no-res", title: "English", seeders: 900 },
    { key: "french", quality: 1080, languages: ["fr"], seeders: 900 },
  ];
  assert.deepEqual(
    rankSources(streams, "en", 2160).map((x) => x.key),
    ["untagged", "1080-big", "720-big", "4k-thin", "french"],
  );
  assert.deepEqual(
    rankSources(streams, "en", 1080).map((x) => x.key),
    ["untagged", "1080-big", "720-big", "french"],
  );
});
test("merging an older copy returns the same object; newer data returns a new one", () => {
  const a = mergeState(blankState(), {
    ...blankState(),
    saved: { x: { meta: { id: "x", type: "movie" }, updatedAt: 5 } },
  });
  assert.equal(mergeState(a, blankState()), a);
  assert.equal(
    mergeState(a, {
      ...blankState(),
      saved: { x: { ...a.saved.x, updatedAt: 4 } },
    }),
    a,
  );
  assert.notEqual(
    mergeState(a, {
      ...blankState(),
      saved: { x: { ...a.saved.x, updatedAt: 6 } },
    }),
    a,
  );
});
test("only titles changed since the last write are returned", () => {
  const state = {
    saved: { a: { meta: { id: "a" }, updatedAt: 10 } },
    progress: {
      b: { meta: { id: "b" }, updatedAt: 20 },
      c: { meta: { id: "b" }, updatedAt: 30 },
    },
    feedback: {},
  };
  assert.deepEqual(
    changedMetas(state, 15).map((m) => m.id),
    ["b"],
  );
  assert.deepEqual(changedMetas(state, 30), []);
});
test("2% starts continuation; 95% completes and queues next released episode", () => {
  let s = recordProgress(blankState(), meta, "e1", 1, 100, 1);
  assert.equal(continueItems(s).length, 0);
  s = recordProgress(s, meta, "e1", 2, 100, 2);
  assert.equal(continueItems(s)[0].videoId, "e1");
  s = recordProgress(s, meta, "e1", 95, 100, 3);
  assert.equal(s.progress.e1.completed, true);
  assert.equal(s.progress.e1.meta.videos, undefined);
  assert.equal(continueItems(s)[0].videoId, "e2");
  s = recordProgress(s, meta, "e2", 95, 100, 4);
  assert.equal(continueItems(s).length, 0);
});
test("manual removal does not mark watched; invalid durations are ignored", () => {
  let s = recordProgress(blankState(), meta, "e1", 20, 100, 1);
  s.progress.e1.hidden = true;
  assert.equal(continueItems(s).length, 0);
  assert.equal(s.progress.e1.completed, false);
  assert.equal(recordProgress(s, meta, "e1", 20, NaN), s);
});
test("merge preserves independent devices and newest tombstones", () => {
  const a = blankState(),
    b = blankState();
  a.saved.a = { meta, updatedAt: 10 };
  b.saved.b = { meta, updatedAt: 20 };
  b.saved.a = { meta, updatedAt: 30, deleted: true };
  const merged = mergeState(a, b);
  assert.equal(Object.keys(merged.saved).length, 2);
  assert.equal(merged.saved.a.deleted, true);
  assert.equal(mergeState(merged, a).saved.a.deleted, true);
});
test("theme defaults to light and follows the newest profile settings", () => {
  const oldState = blankState();
  delete oldState.settings.theme;
  const migrated = mergeState(oldState, blankState());
  assert.equal(migrated.settings.theme, "light");

  const dark = blankState();
  dark.settings.theme = "dark";
  dark.settingsAt = 2;
  assert.equal(mergeState(migrated, dark).settings.theme, "dark");

  const legacyRemote = blankState();
  delete legacyRemote.settings.theme;
  legacyRemote.settingsAt = 3;
  assert.equal(mergeState(dark, legacyRemote).settings.theme, "dark");
});
test("recommendations exclude feedback and rank similar genres", () => {
  const state = blankState();
  state.feedback.a = { meta, value: "more", updatedAt: 1 };
  state.feedback.hidden = { meta, value: "hide", updatedAt: 1 };
  const result = recommend(
    [
      { id: "comedy", genres: ["Comedy"] },
      { id: "drama", genres: ["Drama"] },
      { id: "hidden" },
    ],
    state,
  );
  assert.deepEqual(
    result.map((x) => x.id),
    ["drama", "comedy"],
  );
});
