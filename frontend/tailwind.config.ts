import type { Config } from "tailwindcss";

/**
 * Tailwind Config — Verbatim
 * Extended with our custom design tokens so we can do things like
 * bg-surface, text-accent, border-border-active, etc. in JSX.
 * Way cleaner than raw hex codes everywhere.
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: {
          DEFAULT: "var(--accent)",
          light: "var(--accent-light)",
          dim: "var(--accent-dim)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          elevated: "var(--surface-elevated)",
          hover: "var(--surface-hover)",
        },
        border: {
          DEFAULT: "var(--border)",
          active: "var(--border-active)",
        },
        muted: "var(--muted)",
      },
      // custom animations we can use via className
      animation: {
        "fade-in": "fade-in 0.5s ease-out forwards",
        "fade-in-scale": "fade-in-scale 0.4s ease-out forwards",
        "slide-up": "slide-up 0.6s ease-out forwards",
        shimmer: "shimmer 2s linear infinite",
      },
      // backdrop-blur presets for glass effects
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
