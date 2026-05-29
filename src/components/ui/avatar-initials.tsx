import { cn } from "@/lib/utils";

// Initials derived from the display name. Up to two letters, uppercase.
function initialsFor(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// Stable hue from a string — same input always picks the same gradient.
// Twelve gradients in the spec palette, mod-12 over a tiny hash.
function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const i = h % 6;
  // All gradients land within the brand palette — blue / green / violet —
  // so the contacts page never breaks into off-brand colors.
  const palette = [
    "linear-gradient(135deg, #1d6fd6, #16c088)", // blue → green
    "linear-gradient(135deg, #10519b, #1d6fd6)", // navy → blue
    "linear-gradient(135deg, #6b4ed8, #1d6fd6)", // violet → blue
    "linear-gradient(135deg, #0ea371, #16c088)", // green deep → green
    "linear-gradient(135deg, #1d6fd6, #6b4ed8)", // blue → violet
    "linear-gradient(135deg, #0a2540, #10519b)", // ink → blue
  ];
  return palette[i]!;
}

// Gradient circle with white initials inside. Used in the contacts list
// (and reusable anywhere we need a quick person-avatar without an image).
export function AvatarInitials({
  name,
  size = 32,
  className,
  seed,
}: {
  name: string | null | undefined;
  size?: number;
  className?: string;
  seed?: string;
}) {
  const text = initialsFor(name);
  const gradient = gradientFor(seed ?? name ?? text);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-display font-bold text-white",
        className
      )}
      style={{
        width: size,
        height: size,
        background: gradient,
        fontSize: Math.round(size * 0.42),
        letterSpacing: "-0.02em",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
      }}
    >
      {text}
    </span>
  );
}
