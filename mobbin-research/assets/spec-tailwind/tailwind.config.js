/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src_components.html"],
  theme: {
    extend: {
      colors: {
        miro: {
          yellow: "#FDE050",
          blue: "#3859FF",
          bluedark: "#314CD9",
          violet: "#867AFF",
          ink: "#1C1C1E",
          muted: "#555A6A",
          surface: "#FAFAFC",
          canvas: "#FFFFFF",
          mist: "#F1F2F5",
          line: "#C7CAD5",
          "line-light": "#E5E7EB",
        },
      },
      fontFamily: {
        roobert: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        miro: "8px",
      },
      boxShadow: {
        miro: "0px 0.6px 0.6px -1.25px rgba(0,0,0,0.18), 0px 2.3px 2.3px -2.5px rgba(0,0,0,0.16), 0px 10px 10px -3.75px rgba(0,0,0,0.06)",
        "miro-lg": "0px 1.2px 1.2px -1.25px rgba(0,0,0,0.18), 0px 4.6px 4.6px -2.5px rgba(0,0,0,0.16), 0px 20px 20px -3.75px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
