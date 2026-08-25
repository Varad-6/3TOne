// import rateLimit from "express-rate-limit";
// import slowDown from "express-slow-down";

// // 1. Strict Limiter for Auth (Login/Register) - Blocks Brute Force
// export const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 20, // Limit each IP to 20 login attempts per window
//   message: {
//     error: "Too many login attempts, please try again after 15 minutes.",
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// // 2. Speed Limiter (Throttling) - Slows down heavy users gently
// export const speedLimiter = slowDown({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   delayAfter: 100, // allow 100 requests per 15 minutes without slowing down

//   // UPDATED: Changed from integer 500 to a function to fix v2 warning
//   // This calculates the delay as: (requests_over_limit) * 500ms
//   delayMs: (used, req) => {
//     const delayAfter = req.slowDown.limit;
//     return (used - delayAfter) * 500;
//   },
// });

// // 3. General Hard Limiter - Prevents DoS/Crashes
// export const generalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 1000, // Hard limit at 1000 requests per 15 mins
//   message: { error: "Too many requests, please try again later." },
//   standardHeaders: true,
//   legacyHeaders: false,
// });
