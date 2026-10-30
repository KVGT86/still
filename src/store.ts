import { useEffect, useRef, useState } from "react";
import type { ProfileState, Session } from "./types";
import { blankState, mergeState } from "../shared/domain.mjs";
import {
  companion,
  readLibrary,
  importLibrary,
  libraryChange,
  writeLibrary,
} from "./api";
export function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
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
  const dirty = useRef(false);
  const library = useRef<any[]>([]);
  const loaded = useRef(false);
  function install(value: ProfileState) {
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
    const cached = readLocal<ProfileState>(key, blankState());
    install(cached);
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
          install(mergeState(ref.current, incoming));
          loaded.current = true;
          setSyncStatus("");
        }
      } catch {
        if (alive) {
          loaded.current = true;
          setSyncStatus("Sync unavailable · changes kept on this device");
        }
      }
    };
    void pull();
    return () => {
      alive = false;
      loaded.current = false;
    };
  }, [key, session?.authKey, profileToken]);
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
            const metas = new Map();
            for (const field of ["saved", "progress", "feedback"] as const)
              for (const v of Object.values(sent[field]))
                metas.set(v.meta.id, v.meta);
            const changes = [...metas.values()].map((m) =>
              libraryChange(
                m,
                sent,
                library.current.find((x) => x._id === m.id),
              ),
            );
            if (changes.length) await writeLibrary(session.authKey, changes);
            if (!alive) return;
            library.current = changes;
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
      } catch {
        if (alive)
          setSyncStatus("Sync unavailable · changes kept on this device");
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
        }
      } catch {
        if (alive)
          setSyncStatus("Sync unavailable · changes kept on this device");
      } finally {
        working = false;
      }
    }, 15000);
    const timer = setInterval(sync, 5000);
    window.addEventListener("online", sync);
    return () => {
      alive = false;
      clearInterval(timer);
      clearInterval(poll);
      window.removeEventListener("online", sync);
    };
  }, [key, session?.authKey, profileToken]);
  function update(fn: (current: ProfileState) => ProfileState) {
    const next = fn(ref.current);
    dirty.current = true;
    localStorage.setItem(key + ":dirty", "true");
    install(next);
  }
  return {
    state: (stateKey === key ? state : blankState()) as ProfileState,
    update,
    syncStatus,
  };
}
