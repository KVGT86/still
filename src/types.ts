export type Meta = {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  background?: string;
  description?: string;
  genres?: string[];
  releaseInfo?: string;
  imdbRating?: string;
  runtime?: string;
  videos?: Episode[];
};
export type Episode = {
  id: string;
  title?: string;
  name?: string;
  season: number;
  episode: number;
  released?: string;
  thumbnail?: string;
};
export type Stream = {
  key: string;
  name?: string;
  title?: string;
  description?: string;
  url?: string;
  infoHash?: string;
  fileIdx?: number | null;
  sources?: string[];
  announce?: string[];
  fileMustInclude?: string[];
  subtitles?: { url: string; lang: string }[];
  behaviorHints?: {
    proxyHeaders?: { request?: Record<string, string> };
    filename?: string;
  };
  [key: string]: any;
};
export type Progress = {
  meta: Meta;
  videoId: string;
  position: number;
  duration: number;
  completed: boolean;
  hidden: boolean;
  queued?: boolean;
  updatedAt: number;
};
export type ProfileState = {
  saved: Record<string, { meta: Meta; deleted?: boolean; updatedAt: number }>;
  progress: Record<string, Progress>;
  feedback: Record<string, { meta: Meta; value: string; updatedAt: number }>;
  settings: {
    theme: string;
    interfaceSounds: boolean;
    audio: string;
    subtitle: string;
    subtitles: boolean;
    autoplay: string;
  };
  settingsAt: number;
};
export type Profile = {
  id: string;
  name: string;
  avatar: string;
  locked: boolean;
};
export type Session = {
  authKey: string;
  user: { _id: string; email?: string };
};
export type Addon = {
  transportUrl: string;
  manifest: {
    id: string;
    name: string;
    types: string[];
    resources: (
      string | { name: string; types?: string[]; idPrefixes?: string[] }
    )[];
    catalogs: {
      id: string;
      type: string;
      name?: string;
      extra?: { name: string; isRequired?: boolean }[];
    }[];
  };
};
declare global {
  interface Window {
    StillDesktop?: { engineURL: () => Promise<string> };
    PalmSystem?: { deviceInfo: string };
    StillNative?: {
      play: (payload: string) => void;
      maxQuality: () => number;
    };
    stillProgress?: (data: any) => void;
    stillPlaybackEnded?: (ended?: boolean) => void;
    stillPlaybackFailed?: (message: string) => void;
    stillNext?: () => void;
    stillShowSources?: () => void;
  }
}
