import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0f",
        surface: "#111118",
        border: "#1e1e2e",
        muted: "#2a2a3e",
        "text-primary": "#e8e8f0",
        "text-muted": "#666688",
        accent: "#7c3aed",
        "accent-light": "#a78bfa",
        tool: "#0d9488",
        "tool-light": "#2dd4bf",
        error: "#dc2626",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
