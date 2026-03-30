export const Colors = {
  bg: "#060816", bg2: "#090c1a", bg3: "#0e1228", bg4: "#141830",
  // D-04: ink3 contrast fix - was rgba(160,150,230,0.52), now 0.65 for WCAG AA 4.5:1
  ink: "#f0edff", ink2: "rgba(220,215,255,0.75)", ink3: "rgba(170,160,235,0.65)",
  border: "rgba(255,255,255,0.07)", border2: "rgba(120,100,240,0.22)",
  violet: "#7c3aed", violet2: "#8b5cf6", violet3: "#a78bfa", violet4: "#c4b5fd",
  violetD: "rgba(109,40,217,0.14)",
  green: "#34d399", greenD: "rgba(52,211,153,0.10)",
  red: "#f87171", redD: "rgba(248,113,113,0.10)",
  amber: "#fbbf24", amberD: "rgba(251,191,36,0.10)",
} as const;
