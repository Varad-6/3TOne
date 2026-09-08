
// import "dotenv/config";
// import express from "express";
// import cors from "cors";
// import helmet from "helmet";
// import morgan from "morgan";
// import compression from "compression";
// import cookieParser from "cookie-parser";
// import path from "path"; // 1. Import path
// import { fileURLToPath } from "url"; // 2. Import fileURLToPath
// import https from "https";

// // Import custom middleware
// import routes from "./routes/index.js";
// import errorHandler from "./middleware/errorHandler.js";
// import fs from "fs"; // For reading certificate files

// // import {
// //   authLimiter,
// //   speedLimiter,
// //   generalLimiter,
// // } from "./middleware/rateLimiters.js";

// // -----------------------
// // SSL Certificate Loading (if using HTTPS)
// // -----------------------
// const privateKey = fs.readFileSync("C:/timesheet_pro/timesheet-backend/SSL/private.key", "utf8");
// const certificate = fs.readFileSync("C:/timesheet_pro/timesheet-backend/SSL/certificate.crt", "utf8");
// const caBundle = fs.readFileSync("C:/timesheet_pro/timesheet-backend/SSL/caBundle.crt", "utf8"); // Optional, but recommended


// const credentials = {
//   key: privateKey,
//   cert: certificate,
//   ca: caBundle, // Include if you have a CA bundle
// };

// // 3. Fix __dirname for ES Modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const frontendPath = path.join(__dirname, "../../timesheet-frontend/dist");

// const app = express();
// const PORT = process.env.PORT || 5000;

// // ----------------------
// // Security middleware
// // ----------------------
// // Disable CSP if needed for inline scripts in your React app,
// // otherwise keep helmet() default if it works for you.
// app.use(
//   helmet({
//     contentSecurityPolicy: false,
//   })
// );

// app.use(
//   cors({
//     origin: process.env.FRONTEND_URL || "http://localhost:3000",
//     credentials: true,
//   })
// );

// // ----------------------
// // No-Cache Middleware (Fixes Back Button Issue)
// // ----------------------
// app.use((req, res, next) => {
//   // 4. Exclude static assets from no-cache so images/css load fast
//   if (
//     req.path.startsWith("/assets/") ||
//     req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)
//   ) {
//     next();
//   } else {
//     res.set(
//       "Cache-Control",
//       "no-store, no-cache, must-revalidate, proxy-revalidate"
//     );
//     res.set("Pragma", "no-cache");
//     res.set("Expires", "0");
//     res.set("Surrogate-Control", "no-store");
//     next();
//   }
// });

// // ----------------------
// // Rate Limiting (Applied from rateLimiters.js)
// // ----------------------
// // app.use("/api/auth", authLimiter); // Strict limits for Login/Register
// // app.use("/api", speedLimiter, generalLimiter); // General limits for everything else

// // ----------------------
// // Body parsing middleware
// // ----------------------
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());
// app.use(compression());

// // ----------------------
// // Logging middleware
// // ----------------------
// if (process.env.NODE_ENV === "development") {
//   app.use(morgan("dev"));
// } else {
//   app.use(morgan("combined"));
// }

// // ----------------------
// // Health check endpoint
// // ----------------------
// // app.get("/health", (req, res) => {
// //   res.json({ status: "OK", timestamp: new Date().toISOString() });
// // });

// // ----------------------
// // Main API routes
// // ----------------------
// app.use("/api", routes);

// // ==================================================
// // DEPLOYMENT: Serve Static Frontend Files
// // ==================================================
// // 5. Serve the 'dist' folder as static assets
// // Make sure your 'dist' folder is at the same level as this server file (or adjust path)
// app.use(express.static(frontendPath));
// app.get("/", (req, res) => {
//   res.sendFile(path.join(frontendPath, "index.html"));
// });
// // 6. Handle Client-Side Routing (The Catch-All Route)
// // If request is NOT an API call, serve index.html
// app.get("*", (req, res) => {
//   res.sendFile(path.join(frontendPath, "index.html"));
// });

// // ----------------------
// // Global error handling (must be last)
// // ----------------------
// app.use(errorHandler);
// const httpsServer = https.createServer(credentials, app);
// // ----------------------
// // Start server
// // ----------------------
// httpsServer.listen(PORT, () => {
//   console.log(
//     `🚀 Server running on port https://www.timetrack.abhiyantatech.com:${PORT} in ${
//       process.env.NODE_ENV
//     } mode`
//   );
// });

// export default app;

//_____________________________________________________________________________________________________________
//-------------------------------------------------------------------------------------------------------------
//*************************************************************************************************************

// // ✅ Load dotenv FIRST before any other imports
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Import custom middleware
import routes from "./routes/index.js";
import emailRoutes from "./routes/emailRoutes.js"; // ← NEW
import errorHandler from "./middleware/errorHandler.js";
import { initEmailCrons } from "./controllers/emailController.js";
import { initDbBackupCron } from "./controllers/dbBackup.js";



// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5000;

// ----------------------
// Security middleware
// ----------------------
//app.use(
//  helmet({
//    contentSecurityPolicy: {
//      directives: {
//        defaultSrc: ["'self'"],
//        connectSrc: ["'self'"],
//      },
//    },
//  })
//);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);


// CORS for development
//  app.use(
//    cors({
      // origin: process.env.FRONTEND_URL || "http://localhost:5173",
//      origin: true,
//      credentials: true,
//    })
//  );


app.use(
  cors({
    origin: [
	 "http://timetrack.abhiyantatech.com",
         "https://timetrack.abhiyantatech.com",
    ],
    credentials: true,
  })
);



// No-Cache Middleware
app.use((req, res, next) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  next();
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// ----------------------
// Health check endpoint
// ----------------------
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ----------------------
// Root endpoint - For backend testing
// ----------------------
// app.get("/", (req, res) => {
//   res.send("Backend server is running 🚀");
// });

// ----------------------
// API routes
// ----------------------
app.use("/api", routes);
app.use("/api/email", emailRoutes);


// ----------------------
// ✅ Serve React Build Files at /web
// ----------------------

if (process.env.NODE_ENV === "production") {
  const reactBuildPath = path.join(__dirname, "../../Frontend/dist");
  const indexPath = path.join(reactBuildPath, "index.html");

  if (fs.existsSync(indexPath)) {
    app.use(express.static(reactBuildPath));
    app.get("*", (req, res) => {
      res.sendFile(indexPath);
    });
  } else {
    app.get("/", (req, res) => {
      res.json({
        status: "OK",
        service: "Timesheet Backend API",
        message: "API server is running. Please access the web app at http://localhost:3000",
        frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
      });
    });
  }
}

// ----------------------
// Global error handling (MUST BE LAST)
// ----------------------
app.use(errorHandler);


//----------------------
// Initialize Email Cron Jobs
//----------------------
initEmailCrons(); 


// ----------------------
// Initialize DB Backup Cron Job
// ----------------------
initDbBackupCron();

// ----------------------
// Start server
// ----------------------
app.listen(PORT, "0.0.0.0" ,() => {
  console.log(
    `🚀 Server running on http://localhost:${PORT} in ${
      process.env.NODE_ENV || "development"
    } mode`
  );
//  console.log(`🔌 API: http://localhost:${PORT}/api`);
//  console.log(`📧 Email API: http://localhost:${PORT}/api/email`);
  // console.log(`📱 Frontend: http://localhost:${PORT}/web`);
  // console.log(`🔌 API: http://localhost:${PORT}/api`);
});

export default app;

// //*********************************************************************************************************
// //_________________________________________________________________________________________________________
// // // ✅ Load dotenv FIRST before any other imports
// import "dotenv/config";

// import express from "express";
// import cors from "cors";
// import helmet from "helmet";
// import morgan from "morgan";
// import compression from "compression";
// import cookieParser from "cookie-parser";

// // Import custom middleware
// import routes from "./routes/index.js";
// import errorHandler from "./middleware/errorHandler.js";
// // import {
// //   authLimiter,
// //   speedLimiter,
// //   generalLimiter,
// // } from "./middleware/rateLimiters.js";

// const app = express();
// const PORT = process.env.PORT || 5000;

// // ----------------------
// // Security middleware
// // ----------------------
// // app.use(helmet());
// // app.use(
// //   cors({
// //     origin: process.env.FRONTEND_URL || "http://localhost:3000",
// //     credentials: true,
// //   })
// // );
// // app.use(
// //   helmet({
// //     contentSecurityPolicy: {
// //       directives: {
// //         defaultSrc: ["'self'"],
// //         connectSrc: ["'self'", "http://localhost:*"],
// //       },
// //     },
// //   })
// // );

// app.use(
//   helmet({
//     contentSecurityPolicy: false,
//   })
// );


// // ----------------------
// // No-Cache Middleware (Fixes Back Button Issue)
// // ----------------------
// app.use((req, res, next) => {
//   res.set(
//     "Cache-Control",
//     "no-store, no-cache, must-revalidate, proxy-revalidate"
//   );
//   res.set("Pragma", "no-cache");
//   res.set("Expires", "0");
//   res.set("Surrogate-Control", "no-store");
//   next();
// });

// // ----------------------
// // Rate Limiting (Applied from rateLimiters.js)
// // ----------------------
// // app.use("/api/auth", authLimiter); // Strict limits for Login/Register
// // app.use("/api", speedLimiter, generalLimiter); // General limits for everything else

// // ----------------------
// // Body parsing middleware
// // ----------------------
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());
// app.use(compression());

// // ----------------------
// // Logging middleware
// // ----------------------
// if (process.env.NODE_ENV === "development") {
//   app.use(morgan("dev"));
// } else {
//   app.use(morgan("combined"));
// }

// // ----------------------
// // Health check endpoint
// // ----------------------
// app.get("/health", (req, res) => {
//   res.json({ status: "OK", timestamp: new Date().toISOString() });
// });

// app.get("/", (req, res) => {
//   res.send("Backend server is running 🚀");
// });

// // ----------------------
// // Main API routes
// // ----------------------
// app.use("/api", routes);

// // ----------------------
// // Global error handling (must be last)
// // ----------------------
// app.use(errorHandler);

// // ----------------------
// // Start server
// // ----------------------
// app.listen(PORT, () => {
//   console.log(
//     `🚀 Server running on port ${PORT} in ${
//       process.env.NODE_ENV || "development"
//     } mode`
//   );
// });

// export default app;

//----------------------------------------------------------------------------------------------------------
//__________________________________________________________________________________________________________

// ✅ Load dotenv FIRST before any other imports
