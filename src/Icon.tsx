import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowLeftRight,
  Bookmark,
  Captions,
  Check,
  ChevronRight,
  CircleUserRound,
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
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  X,
} from "lucide-react";
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
];
