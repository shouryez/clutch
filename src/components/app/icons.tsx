import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({ width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, ...p });

export const I = {
  home: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  ),
  pipeline: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="11" rx="1.5" />
      <rect x="17" y="4" width="4" height="7" rx="1.5" />
    </svg>
  ),
  accounts: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
      <path d="M15 9h3a2 2 0 0 1 2 2v10M3 21h18M8 7h3M8 11h3M8 15h3" />
    </svg>
  ),
  phone: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </svg>
  ),
  deal: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M8 12 3 7l4-4 5 5M16 12l5-5-4-4-5 5M8 12l4 4 4-4M12 16v5" />
    </svg>
  ),
  bug: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <rect x="7" y="7" width="10" height="13" rx="5" />
      <path d="M12 7V4M9 4l1.5 3M15 4l-1.5 3M3 12h4M17 12h4M4 18l3-2M20 18l-3-2M4 7l3 2M20 7l-3 2" />
    </svg>
  ),
  chart: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 6-7" />
    </svg>
  ),
  bolt: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  ),
  inbox: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" />
    </svg>
  ),
  doc: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h4" />
    </svg>
  ),
  brief: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M7 12l3-3 2.5 2L17 7M12 16v4M8.5 20h7" />
    </svg>
  ),
  shield: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z" />
      <path d="m8.8 12.2 2.2 2.2 4.3-4.6" />
    </svg>
  ),
  gear: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
    </svg>
  ),
  sidebar: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  ),
  plug: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4" />
    </svg>
  ),
  store: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M4 7h16l-1 13H5zM8 7a4 4 0 0 1 8 0" />
    </svg>
  ),
  search: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  bell: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />
    </svg>
  ),
  spark: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
    </svg>
  ),
  close: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  arrow: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  refresh: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
    </svg>
  ),
};
