import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#141414",
        paper: "#f7f3ec",
        bronze: "#8b5e34",
        moss: "#60745f",
        rose: "#d9c5b2",
        line: "#e4ddd2"
      },
      fontFamily: {
        sans: ["var(--font-sans)"]
      }
    }
  },
  plugins: []
};

export default config;
