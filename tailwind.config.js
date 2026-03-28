module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg:     { DEFAULT: "#060816", 2: "#090c1a", 3: "#0e1228", 4: "#141830" },
        ink:    { DEFAULT: "#f0edff", 2: "rgba(220,215,255,0.75)", 3: "rgba(160,150,230,0.52)" },
        violet: { DEFAULT: "#7c3aed", 2: "#8b5cf6", 3: "#a78bfa", 4: "#c4b5fd" },
        green:  "#34d399",
        red:    "#f87171",
        amber:  "#fbbf24",
      },
    },
  },
  plugins: [],
};
```

**`.env.example`**
```
EXPO_PUBLIC_API_URL=https://aura-backend-production-f805.up.railway.app/api/v1
