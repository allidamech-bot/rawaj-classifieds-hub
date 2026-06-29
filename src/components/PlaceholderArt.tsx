import type { PlaceholderType } from "@/types";

const palette: Record<PlaceholderType, { bg: string; fg: string; accent: string }> = {
  car:         { bg: "#EEE7D8", fg: "#101722", accent: "#B88A44" },
  realestate:  { bg: "#E7EDE9", fg: "#166B52", accent: "#166B52" },
  phone:       { bg: "#E8EAF0", fg: "#101722", accent: "#B88A44" },
  electronics: { bg: "#EEE7D8", fg: "#101722", accent: "#5D625F" },
  furniture:   { bg: "#F2EAD8", fg: "#101722", accent: "#B88A44" },
  job:         { bg: "#E7EDE9", fg: "#166B52", accent: "#166B52" },
  service:     { bg: "#EEE7D8", fg: "#101722", accent: "#C9822B" },
  fashion:     { bg: "#F2E5DC", fg: "#101722", accent: "#B88A44" },
  food:        { bg: "#EEE7D8", fg: "#166B52", accent: "#166B52" },
  animals:     { bg: "#E8E4D6", fg: "#5D625F", accent: "#B88A44" },
  education:   { bg: "#E8EAF0", fg: "#101722", accent: "#166B52" },
  business:    { bg: "#EEE7D8", fg: "#101722", accent: "#B88A44" },
  misc:        { bg: "#EEE7D8", fg: "#5D625F", accent: "#B88A44" },
};

interface Props {
  type: PlaceholderType;
  label?: string;
  className?: string;
  aspect?: "square" | "wide" | "tall";
}

// Symbolic SVG placeholders per category – no emoji, no broken images.
export function PlaceholderArt({ type, label, className = "", aspect = "wide" }: Props) {
  const c = palette[type];
  const ratio = aspect === "square" ? "aspect-square" : aspect === "tall" ? "aspect-[4/5]" : "aspect-[16/10]";

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl ${ratio} ${className}`}
      style={{ backgroundColor: c.bg }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 120" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={`grid-${type}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke={c.fg} strokeOpacity="0.05" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="200" height="120" fill={`url(#grid-${type})`} />
        <Glyph type={type} color={c.fg} accent={c.accent} />
      </svg>
      {label && (
        <span
          className="absolute bottom-2 start-2 rounded-md bg-card/85 px-2 py-0.5 text-[11px] font-medium"
          style={{ color: c.fg }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function Glyph({ type, color, accent }: { type: PlaceholderType; color: string; accent: string }) {
  const s = { stroke: color, strokeWidth: 2.5, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (type) {
    case "car":
      return (
        <g transform="translate(60,40)">
          <path d="M5 30 L12 12 H68 L75 30" {...s} />
          <rect x="0" y="30" width="80" height="18" rx="4" {...s} />
          <circle cx="18" cy="50" r="6" {...s} fill={accent} />
          <circle cx="62" cy="50" r="6" {...s} fill={accent} />
        </g>
      );
    case "realestate":
      return (
        <g transform="translate(70,30)">
          <path d="M5 55 V25 L30 5 L55 25 V55 Z" {...s} />
          <rect x="20" y="35" width="20" height="20" {...s} fill={accent} fillOpacity="0.15" />
          <path d="M5 55 H55" {...s} />
        </g>
      );
    case "phone":
      return (
        <g transform="translate(85,25)">
          <rect x="0" y="0" width="30" height="60" rx="5" {...s} />
          <line x1="12" y1="52" x2="18" y2="52" {...s} stroke={accent} />
          <circle cx="15" cy="8" r="1.5" fill={color} />
        </g>
      );
    case "electronics":
      return (
        <g transform="translate(60,30)">
          <rect x="0" y="0" width="80" height="48" rx="3" {...s} />
          <line x1="35" y1="55" x2="45" y2="55" {...s} stroke={accent} />
          <line x1="20" y1="58" x2="60" y2="58" {...s} />
        </g>
      );
    case "furniture":
      return (
        <g transform="translate(55,40)">
          <path d="M5 30 V20 Q5 10 15 10 H75 Q85 10 85 20 V30" {...s} />
          <rect x="0" y="30" width="90" height="14" rx="3" {...s} fill={accent} fillOpacity="0.2" />
          <line x1="10" y1="44" x2="10" y2="55" {...s} />
          <line x1="80" y1="44" x2="80" y2="55" {...s} />
        </g>
      );
    case "job":
      return (
        <g transform="translate(70,30)">
          <rect x="0" y="15" width="60" height="40" rx="4" {...s} />
          <path d="M20 15 V8 H40 V15" {...s} />
          <line x1="0" y1="32" x2="60" y2="32" {...s} stroke={accent} />
        </g>
      );
    case "service":
      return (
        <g transform="translate(75,30)">
          <path d="M10 50 L40 20 M30 10 L50 30 L40 40 L20 20 Z" {...s} fill={accent} fillOpacity="0.2" />
        </g>
      );
    case "fashion":
      return (
        <g transform="translate(70,25)">
          <path d="M20 5 L30 15 L40 5 L60 15 L50 25 V55 H10 V25 L0 15 Z" {...s} fill={accent} fillOpacity="0.15" />
        </g>
      );
    case "food":
      return (
        <g transform="translate(75,30)">
          <ellipse cx="25" cy="40" rx="25" ry="8" {...s} fill={accent} fillOpacity="0.2" />
          <path d="M5 40 Q5 20 25 18 Q45 20 45 40" {...s} />
        </g>
      );
    case "animals":
      return (
        <g transform="translate(70,30)">
          <ellipse cx="30" cy="35" rx="25" ry="14" {...s} />
          <circle cx="10" cy="22" r="8" {...s} fill={accent} fillOpacity="0.2" />
          <line x1="15" y1="49" x2="15" y2="58" {...s} />
          <line x1="45" y1="49" x2="45" y2="58" {...s} />
        </g>
      );
    case "education":
      return (
        <g transform="translate(60,30)">
          <path d="M5 25 L40 10 L75 25 L40 40 Z" {...s} fill={accent} fillOpacity="0.2" />
          <line x1="20" y1="32" x2="20" y2="48" {...s} />
          <path d="M20 48 Q40 56 60 48" {...s} />
        </g>
      );
    case "business":
      return (
        <g transform="translate(65,30)">
          <rect x="0" y="0" width="70" height="55" {...s} />
          <line x1="0" y1="18" x2="70" y2="18" {...s} />
          <line x1="35" y1="0" x2="35" y2="55" {...s} />
          <rect x="28" y="35" width="14" height="20" {...s} fill={accent} fillOpacity="0.2" />
        </g>
      );
    default:
      return (
        <g transform="translate(85,30)">
          <circle cx="15" cy="25" r="20" {...s} fill={accent} fillOpacity="0.15" />
          <path d="M8 25 H22 M15 18 V32" {...s} />
        </g>
      );
  }
}
