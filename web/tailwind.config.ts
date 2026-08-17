import type { Config } from "tailwindcss";

// Same palette as the Android app's dark theme (colors.xml) so the
// broadcaster overlay, the app UI, and the web platform read as one product.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0F1620",
        panel: "#141B26",
        accent: "#E4392F",
        home: "#2FA8E4",
        away: "#E4392F",
        textprimary: "#FFFFFF",
        textsecondary: "#B7C2CC",
        live: "#E4392F",
        ok: "#3ECF6E",
      },
    },
  },
  plugins: [],
};

export default config;
