import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.5rem", screens: { "2xl": "1320px" } },
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        serif:   ["var(--font-serif)", "system-ui", "sans-serif"],
        sans:    ["var(--font-body)", "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        // shadcn / 21st.dev token names, backed by the vars in globals.css.
        // Channel form so `bg-foreground/10` and friends keep working.
        background:          "rgb(var(--bg) / <alpha-value>)",
        foreground:          "rgb(var(--fg) / <alpha-value>)",
        "muted-foreground":  "rgb(var(--mfg) / <alpha-value>)",
        card:                "rgb(var(--card) / <alpha-value>)",
        "card-foreground":   "rgb(var(--card-fg) / <alpha-value>)",
        border:              "rgb(var(--bdr) / <alpha-value>)",
        ring:                "rgb(var(--rng) / <alpha-value>)",

        ink:       "#161515",
        graphite:  "#1C1B1B",
        charcoal:  "#222020",
        frost:     { DEFAULT: "#FFFFFF", deep: "#F1F1F2" },
        haze:      "#F4F4F5",
        cloud:     "#F4F4F5",
        mist:      "#F3F3F4",
        paper:     "#FFFFFF",
        accent:    { DEFAULT: "#F1592B", deep: "#D8431A", soft: "#FDE4D9" },
        lime:      { DEFAULT: "#D7F26B", deep: "#BFE03E", dark: "#9FBF24" },
        camel:     { DEFAULT: "#C19A6B", deep: "#A87E4E" },
        muted:     "#5F5A57",
        subtle:    "#6B6360", // meets WCAG AA on white
        line:      "rgba(22,21,21,0.10)",
        surface: { 0:"#FFFFFF", 1:"#FFFFFF", 2:"#F4F4F5", 3:"#ECECEE", dark:"#161515" },
      },
      borderRadius: {
        "2xl": "1.25rem", "3xl": "1.75rem", "4xl": "2.5rem", pill: "999px",
      },
      boxShadow: {
        hair: "0 1px 0 rgba(10,10,11,.04)",
        soft: "0 1px 2px rgba(10,10,11,.04)",
        card: "0 4px 14px rgba(10,10,11,.06)",
        lift: "0 12px 32px rgba(10,10,11,.08)",
        deep: "0 24px 60px rgba(10,10,11,.12)",
        cinematic: "0 40px 80px -20px rgba(10,10,11,.5)",
        glow: "0 12px 40px rgba(46,91,255,.18)",
        lime: "0 10px 22px rgba(191,224,62,.45)",
        innerline: "inset 0 0 0 1px rgba(255,255,255,.08)",
      },
      letterSpacing: {
        "tightest": "-0.05em",
      },
      keyframes: {
        floaty:   { "0%,100%": { transform: "translateY(0) rotate(0)" }, "50%": { transform: "translateY(-14px) rotate(-1.5deg)" } },
        spin360:  { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
        pop:      { from: { transform: "scale(.4)", opacity: "0" }, to: { transform: "scale(1)", opacity: "1" } },
        marquee:  { from: { transform: "translateX(0)" }, to: { transform: "translateX(calc(-100% - var(--gap)))" } },
        "marquee-vertical": { from: { transform: "translateY(0)" }, to: { transform: "translateY(calc(-100% - var(--gap)))" } },
        shimmer:  { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        rise:     { from: { transform: "translateY(40px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
        fadeIn:   { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        floaty: "floaty 7s ease-in-out infinite",
        spin360: "spin360 40s linear infinite",
        pop:    "pop 600ms cubic-bezier(.34,1.56,.64,1)",
        marquee:"marquee var(--duration,30s) linear infinite",
        "marquee-vertical":"marquee-vertical var(--duration,30s) linear infinite",
        shimmer:"shimmer 2.6s linear infinite",
        rise:   "rise 700ms cubic-bezier(.22,.61,.36,1) both",
        "fade-in": "fadeIn 300ms ease-out both",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(.34,1.56,.64,1)",
        elegant: "cubic-bezier(.22,.61,.36,1)",
      },
      backgroundImage: {
        grain: "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0, 0 0 0 0 0, 0 0 0 0 0, 0 0 0 0.12 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>\")",
      },
    },
  },
  plugins: [],
};
export default config;
