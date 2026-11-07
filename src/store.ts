import { useEffect, useRef, useState } from "react";
import type { ProfileState, Session } from "./types";
import { blankState, changedMetas, mergeState } from "../shared/domain.mjs";
import {
  companion,
  readLibrary,
  importLibrary,
  libraryChange,
  writeLibrary,
} from "./api";
export type SyncInfo = {
  state: "loading" | "synced" | "pending" | "cached";
  lastSynced: number;
  pending: number;
  message: string;
};
export function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
const newest = (s: ProfileState) =>
  Math.max(
    0,
    ...(["saved", "progress", "feedback"] as const).flatMap((f) =>
      Object.values(s[f]).map((v) => v.updatedAt),
    ),
  );
export function useProfileStore(
  session: Session | null,
  service: string,
  token: string,
  profileId: string,
  profileToken: string,
) {
  const key = `still:${session?.user._id}:${service || "single"}:${profileId || "single"}`;
  const [state, setState] = useState<ProfileState>(blankState());
  const [stateKey, setStateKey] = useState(key);
  const ref = useRef(state);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncInfo, setSyncInfo] = useState<SyncInfo>({
    state: "loading",
    lastSynced: 0,
    pending: 0,
    message: "Loading profile",
  });
  const [conflict, setConflict] = useState<{
    local: ProfileState;
    remote: ProfileState;
  } | null>(null);
  const dirty = useRef(false);
  const library = useRef<any[]>([]);
  const loaded = useRef(false);
  const written = useRef(0);
  function install(value: ProfileState) {
    if (value === ref.current) return;
    ref.current = value;
    setState(value);
    setStateKey(key);
    localStorage.setItem(key, JSON.stringify(value));
  }
  useEffect(() => {
    if (!session || !profileId) return;
    let alive = true;
    loaded.current = false;
    dirty.current = readLocal(key + ":dirty", false);
    const legacyTheme = readLocal<"light" | "dark">("still.theme", "light");
    const stored = readLocal<ProfileState | null>(key, null);
    const cached = {
      ...blankState(),
      ...stored,
      settings: {
        ...blankState().settings,
        ...stored?.settings,
        theme: stored?.settings?.theme || legacyTheme,
      },
      sourceHistory: stored?.sourceHistory || {},
      devices: stored?.devices || {},
      collections: stored?.collections || {},
    } as ProfileState;
    if (service && stored && !stored.settings?.theme) {
      dirty.current = true;
      localStorage.setItem(key + ":dirty", "true");
    }
    install(cached);
    if (stored)
      setSyncInfo({
        state: "cached",
        lastSynced: readLocal(key + ":synced", 0),
        pending: dirty.current ? 1 : 0,
        message: "Showing saved profile data",
      });
    const pull = async () => {
      try {
        const incoming = service
          ? await companion(
              service,
              `/profiles/${profileId}/state`,
              token,
              undefined,
              profileToken,
            )
          : importLibrary(
              (library.current = await readLibrary(session.authKey)),
            );
        if (alive) {
          if (dirty.current && stored && newest(incoming) > newest(stored))
            setConflict({ local: ref.current, remote: incoming });
          install(mergeState(ref.current, incoming));
          if (!service) written.current = newest(ref.current);
          loaded.current = true;
          setSyncStatus("");
          const now = Date.now();
          localStorage.setItem(key + ":synced", String(now));
          setSyncInfo({
            state: dirty.current ? "pending" : "synced",
            lastSynced: now,
            pending: dirty.current ? 1 : 0,
            message: dirty.current ? "One local change waiting" : "Up to date",
          });
        }
      } catch {
        if (alive) {
          loaded.current = true;
          setSyncStatus("Sync unavailable · changes kept on this device");
          setSyncInfo((current) => ({
            ...current,
            state: "cached",
            pending: dirty.current ? 1 : 0,
            message: "Server unavailable, using saved profile data",
          }));
        }
      }
    };
    void pull();
    return () => {
      alive = false;
      loaded.current = false;
    };
  }, [key, session?.authKey, profileId, profileToken]);
  useEffect(() => {
    if (!session || !profileId) return;
    let working = false,
      alive = true;
    const sync = async () => {
      if (working || !loaded.current || !alive) return;
      working = true;
      try {
        if (dirty.current) {
          const sent = ref.current;
          if (service) {
            const remote = await companion(
              service,
              `/profiles/${profileId}/state`,
              token,
              sent,
              profileToken,
            );
            if (!alive) return;
            const changed = ref.current !== sent;
            install(mergeState(ref.current, remote));
            if (!changed) {
              dirty.current = false;
              localStorage.setItem(key + ":dirty", "false");
            }
          } else {
            const changes = changedMetas(sent, written.current).map((m) =>
              libraryChange(
                m,
                sent,
                library.current.find((x) => x._id === m.id),
              ),
            );
            if (changes.length) await writeLibrary(session.authKey, changes);
            if (!alive) return;
            const ids = new Set(changes.map((c) => c._id));
            library.current = [
              ...library.current.filter((x) => !ids.has(x._id)),
              ...changes,
            ];
            written.current = Math.max(written.current, newest(sent));
            if (ref.current === sent) {
              dirty.current = false;
              localStorage.setItem(key + ":dirty", "false");
            }
          }
        } else if (service) {
          const remote = await companion(
            service,
            `/profiles/${profileId}/state`,
            token,
            undefined,
            profileToken,
          );
          if (alive) install(mergeState(ref.current, remote));
        }
        if (alive) setSyncStatus("");
        if (alive) {
          const now = Date.now();
          localStorage.setItem(key + ":synced", String(now));
          setSyncInfo({
            state: dirty.current ? "pending" : "synced",
            lastSynced: now,
            pending: dirty.current ? 1 : 0,
            message: dirty.current ? "Local changes waiting" : "Up to date",
          });
        }
      } catch {
        if (alive)
          setSyncStatus("Sync unavailable · changes kept on this device");
        if (alive)
          setSyncInfo((current) => ({
            ...current,
            state: "cached",
            pending: dirty.current ? 1 : 0,
            message: "Server unavailable, using saved profile data",
          }));
      } finally {
        working = false;
      }
    };
    const poll = setInterval(async () => {
      if (service || working || dirty.current || !alive || !loaded.current)
        return;
      working = true;
      try {
        const items = await readLibrary(session.authKey);
        if (alive) {
          library.current = items;
          install(mergeState(ref.current, importLibrary(items)));
          written.current = newest(ref.current);
        }
      } catch {
        if (alive)
          setSyncStatus("Sync unavailable · changes kept on this device");
      } finally {
        working = false;
      }
    }, 15000);
    // Upload promptly after a change; otherwise only check the server every 30 seconds.
    let idle = 0;
    const timer = setInterval(() => {
      if (dirty.current || ++idle % 6 === 0) void sync();
    }, 5000);
    window.addEventListener("online", sync);
    return () => {
      alive = false;
      clearInterval(timer);
      clearInterval(poll);
      window.removeEventListener("online", sync);
    };
  }, [key, session?.authKey, profileId, profileToken]);
  function update(fn: (current: ProfileState) => ProfileState) {
    const next = fn(ref.current);
    dirty.current = true;
    localStorage.setItem(key + ":dirty", "true");
    install(next);
    setSyncInfo((current) => ({
      ...current,
      state: "pending",
      pending: current.pending + 1,
      message: "Changes waiting to sync",
    }));
  }
  function resolveConflict(choice: "local" | "remote") {
    if (!conflict) return;
    if (choice === "remote") {
      dirty.current = false;
      localStorage.setItem(key + ":dirty", "false");
      install(conflict.remote);
    } else {
      dirty.current = true;
      localStorage.setItem(key + ":dirty", "true");
      install(mergeState(conflict.remote, conflict.local));
    }
    setConflict(null);
  }
  return {
    state: (stateKey === key ? state : blankState()) as ProfileState,
    update,
    syncStatus,
    syncInfo,
    conflict,
    resolveConflict,
  };
}
