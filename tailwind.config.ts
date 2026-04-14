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
        background: "#0f0f11",
        surface: "#16161a",
        "surface-2": "#1e1e24",
        "surface-3": "#2a2a32",
        text: "#e0e0e6",
        "text-muted": "#8888a0",
        accent: "#7c6af7",
        "accent-hover": "#6b59e8",
        success: "#22c55e",
        error: "#ef4444",
        warning: "#f59e0b",
      },
    },
  },
  plugins: [],
};
export default config;
