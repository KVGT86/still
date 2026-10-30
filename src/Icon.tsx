import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowLeftRight,
  Bookmark,
  Captions,
  Check,
  ChevronRight,
  Cat,
  CircleUserRound,
  createLucideIcon,
  Dog,
  Eclipse,
  Ellipsis,
  Eye,
  EyeOff,
  Flower2,
  Gem,
  Heart,
  House,
  LoaderCircle,
  Moon,
  Orbit,
  Panda,
  Pause,
  Play,
  Plus,
  Rabbit,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Squirrel,
  Star,
  Sun,
  Turtle,
  X,
} from "lucide-react";
// Hand-drawn to match Lucide's 24px stroke style; Lucide has no clam, eagle, koru, elephant or kiwi.
const Clam = createLucideIcon("clam", [
  [
    "path",
    {
      d: "M12 20.5 5.4 15.2C2.6 12.2 3.2 7.2 8 5.6c2.6-.8 5.4-.8 8 0 4.8 1.6 5.4 6.6 2.6 9.6Z",
      key: "clam0",
    },
  ],
  ["path", { d: "M12 20.5 9 5.8", key: "clam1" }],
  ["path", { d: "M12 20.5V5", key: "clam2" }],
  ["path", { d: "M12 20.5l3-14.7", key: "clam3" }],
  ["path", { d: "M9.6 20.5h4.8", key: "clam4" }],
]);
const Eagle = createLucideIcon("eagle", [
  [
    "path",
    {
      d: "M4.5 21C4.2 13.8 7 8.6 11.8 6.6c2.6-1.1 5.4-.4 6.8 1.6 1.3.9 2.8 2.7 3.1 5.2-1.7-.1-3.4-.9-4.3-2.1",
      key: "eagle0",
    },
  ],
  ["path", { d: "M17.4 11.3c-.2 2.4-1.4 4.4-3.3 5.8l1.9 3.9", key: "eagle1" }],
  ["path", { d: "M8 21c.2-3 1.3-5.4 3.2-7", key: "eagle2" }],
  ["path", { d: "M12.2 9.4l3.3 1.1", key: "eagle3" }],
  ["path", { d: "M14.4 11.2h.01", key: "eagle4" }],
]);
const Koru = createLucideIcon("koru", [
  [
    "path",
    {
      d: "M5 20.5C4.5 11 9 4 15.5 4c3.4 0 5.5 2.6 5.5 5.6 0 3.4-2.7 5.9-5.8 5.9-2.6 0-4.5-1.8-4.5-4.1 0-1.7 1.3-3 3-3",
      key: "koru0",
    },
  ],
  [
    "path",
    { d: "M13.6 12.3m-.9 0a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0", key: "koru1" },
  ],
]);
const Elephant = createLucideIcon("elephant", [
  ["path", { d: "M8.2 7.6C9.6 6.6 14.4 6.6 15.8 7.6", key: "elephant0" }],
  [
    "path",
    {
      d: "M8.5 7.4C5.3 4.2 1.8 6.6 2.6 11c.5 3 2.8 4.7 5.2 4.2",
      key: "elephant1",
    },
  ],
  [
    "path",
    {
      d: "M15.5 7.4c3.2-3.2 6.7-.8 5.9 3.6-.5 3-2.8 4.7-5.2 4.2",
      key: "elephant2",
    },
  ],
  [
    "path",
    {
      d: "M8 8.2C7.6 11.2 8.6 14 10.2 16l-.2 4.4c0 1.3 1.9 1.3 2.3.2L12.6 17c.8-.4 1.6-.4 2.4 0l.5 3.6",
      key: "elephant3",
    },
  ],
  ["path", { d: "M9.6 11.2h.01", key: "elephant4" }],
  ["path", { d: "M14.4 11.2h.01", key: "elephant5" }],
]);
const Kiwi = createLucideIcon("kiwi", [
  [
    "path",
    {
      d: "M5.8 12.6C5.8 9.4 8.8 7.6 12 7.8c4 .2 7.2 2.8 7.2 6.8 0 3-2.6 4.4-6.6 4.4-4.2 0-6.8-2.4-6.8-6.4Z",
      key: "kiwi0",
    },
  ],
  ["path", { d: "M6.3 11.8 1.6 15", key: "kiwi1" }],
  ["path", { d: "M11 19v2.6", key: "kiwi2" }],
  ["path", { d: "M14.4 19v2.6", key: "kiwi3" }],
  ["path", { d: "M8.6 11.2h.01", key: "kiwi4" }],
]);
const icons = {
  back: ArrowLeft,
  next: ArrowRight,
  external: ArrowUpRight,
  switch: ArrowLeftRight,
  saved: Bookmark,
  captions: Captions,
  check: Check,
  chevron: ChevronRight,
  profile: CircleUserRound,
  brand: Eclipse,
  more: Ellipsis,
  watched: Eye,
  hidden: EyeOff,
  flower: Flower2,
  gem: Gem,
  heart: Heart,
  home: House,
  loading: LoaderCircle,
  moon: Moon,
  orbit: Orbit,
  pause: Pause,
  play: Play,
  plus: Plus,
  search: Search,
  settings: Settings,
  sliders: SlidersHorizontal,
  sparkles: Sparkles,
  star: Star,
  sun: Sun,
  close: X,
  cat: Cat,
  clam: Clam,
  dog: Dog,
  eagle: Eagle,
  elephant: Elephant,
  koru: Koru,
  kiwi: Kiwi,
  panda: Panda,
  rabbit: Rabbit,
  squirrel: Squirrel,
  turtle: Turtle,
};
export type IconName = keyof typeof icons;
export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const Component = icons[name];
  return (
    <Component
      size={size}
      strokeWidth={1.7}
      aria-hidden="true"
      className={`icon ${className}`}
    />
  );
}
const avatars: Record<string, IconName> = {
  "◒": "profile",
  "☀": "sun",
  "✳": "sparkles",
  "◈": "gem",
  "☽": "moon",
  "✿": "flower",
  "◉": "orbit",
  "✦": "star",
  cat: "cat",
  clam: "clam",
  dog: "dog",
  eagle: "eagle",
  elephant: "elephant",
  koru: "koru",
  kiwi: "kiwi",
  panda: "panda",
  rabbit: "rabbit",
  squirrel: "squirrel",
  turtle: "turtle",
};
export function Avatar({ value, size = 36 }: { value: string; size?: number }) {
  return <Icon name={avatars[value] || "profile"} size={size} />;
}
export const avatarOptions = [
  ["◒", "Profile"],
  ["☀", "Sun"],
  ["✳", "Sparkles"],
  ["◈", "Gem"],
  ["☽", "Moon"],
  ["✿", "Flower"],
  ["◉", "Orbit"],
  ["✦", "Star"],
  ["cat", "Cat"],
  ["clam", "Clam"],
  ["dog", "Dog"],
  ["eagle", "Eagle"],
  ["elephant", "Elephant"],
  ["koru", "Koru"],
  ["kiwi", "Kiwi"],
  ["panda", "Panda"],
  ["rabbit", "Rabbit"],
  ["squirrel", "Squirrel"],
  ["turtle", "Turtle"],
];
