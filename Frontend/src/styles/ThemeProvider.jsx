// import React, { createContext, useContext, useEffect, useState } from "react";

// const ThemeContext = createContext(undefined);

// export const ThemeProvider = ({ children }) => {
//   const [theme, setTheme] = useState(() => {
//     // Check localStorage first
//     const savedTheme = localStorage.getItem("theme");
//     if (savedTheme) return savedTheme;

//     // Fall back to system preference
//     return window.matchMedia("(prefers-color-scheme: dark)").matches
//       ? "dark"
//       : "light";
//   });

//   useEffect(() => {
//     const root = document.documentElement;

//     // Remove both classes first
//     root.classList.remove("light", "dark");

//     // Add current theme
//     root.classList.add(theme);

//     // Persist to localStorage
//     localStorage.setItem("theme", theme);
//   }, [theme]);

//   const toggleTheme = () => {
//     setTheme((prev) => (prev === "light" ? "dark" : "light"));
//   };

//   const setLightMode = () => setTheme("light");
//   const setDarkMode = () => setTheme("dark");

//   return (
//     <ThemeContext.Provider
//       value={{
//         theme,
//         toggleTheme,
//         setLightMode,
//         setDarkMode,
//       }}
//     >
//       {children}
//     </ThemeContext.Provider>
//   );
// };

// // Custom hook with error checking
// export const useTheme = () => {
//   const context = useContext(ThemeContext);
//   if (context === undefined) {
//     throw new Error("useTheme must be used within ThemeProvider");
//   }
//   return context;
// };
