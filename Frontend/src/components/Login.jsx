import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { toast } from "sonner";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import ais_logo from "../assets/ais_logo.png";

/* ─────────────────────────────────────────────
   SVG 1 — Timesheet document (above card)
───────────────────────────────────────────── */
function TimesheetIcon() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="72" height="72" rx="16" fill="#eff6ff" />
      <rect
        x="16"
        y="12"
        width="40"
        height="48"
        rx="5"
        fill="#fff"
        stroke="#bfdbfe"
        strokeWidth="1.5"
      />
      <rect x="16" y="12" width="40" height="13" rx="5" fill="#3b82f6" />
      <rect x="16" y="19" width="40" height="6" fill="#3b82f6" />
      <rect
        x="21"
        y="16"
        width="18"
        height="3"
        rx="1.5"
        fill="rgba(255,255,255,0.55)"
      />
      {[32, 40, 48].map((y) => (
        <line
          key={y}
          x1="22"
          y1={y}
          x2="50"
          y2={y}
          stroke="#dbeafe"
          strokeWidth="1"
        />
      ))}
      {[30, 38, 46].map((x) => (
        <line
          key={x}
          x1={x}
          y1="28"
          x2={x}
          y2="54"
          stroke="#dbeafe"
          strokeWidth="1"
        />
      ))}
      <rect x="22" y="29" width="7" height="8" rx="1.5" fill="#bfdbfe" />
      <rect x="31" y="29" width="7" height="8" rx="1.5" fill="#3b82f6" />
      <rect x="22" y="41" width="7" height="8" rx="1.5" fill="#bfdbfe" />
      <rect x="39" y="41" width="7" height="8" rx="1.5" fill="#bfdbfe" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   SVG 2 — Clock (top-right corner of card)
───────────────────────────────────────────── */
function ClockAccent() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="22" cy="22" r="22" fill="#eff6ff" />
      <circle
        cx="22"
        cy="22"
        r="13"
        stroke="#bfdbfe"
        strokeWidth="1.5"
        fill="#fff"
      />
      <circle cx="22" cy="22" r="1.8" fill="#3b82f6" />
      <line
        x1="22"
        y1="22"
        x2="22"
        y2="13"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="22"
        y1="22"
        x2="29"
        y2="22"
        stroke="#93c5fd"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {[0, 1, 2, 3].map((i) => {
        const a = (i * 90 - 90) * (Math.PI / 180);
        return (
          <line
            key={i}
            x1={22 + 10 * Math.cos(a)}
            y1={22 + 10 * Math.sin(a)}
            x2={22 + 12 * Math.cos(a)}
            y2={22 + 12 * Math.sin(a)}
            stroke="#bfdbfe"
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────────
   SVG 3 — Weekly hours bar chart
   Floats left of the card
───────────────────────────────────────────── */
function WeeklyChart() {
  const bars = [42, 56, 38, 60, 50, 28, 20]; // heights
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <svg
      width="96"
      height="88"
      viewBox="0 0 96 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="96" height="88" rx="14" fill="#eff6ff" />
      {/* axis */}
      <line x1="10" y1="70" x2="86" y2="70" stroke="#bfdbfe" strokeWidth="1" />
      {/* bars */}
      {bars.map((h, i) => (
        <g key={i}>
          <rect
            x={13 + i * 11}
            y={70 - h * 0.7}
            width="7"
            height={h * 0.7}
            rx="2"
            fill={i === 4 ? "#3b82f6" : "#bfdbfe"}
          />
          <text
            x={13 + i * 11 + 3.5}
            y="80"
            textAnchor="middle"
            fill="#93c5fd"
            fontSize="5.5"
            fontFamily="sans-serif"
          >
            {days[i]}
          </text>
        </g>
      ))}
      {/* label */}
      <text
        x="48"
        y="10"
        textAnchor="middle"
        fill="#3b82f6"
        fontSize="6"
        fontWeight="700"
        fontFamily="sans-serif"
      >
        WEEKLY HRS
      </text>
    </svg>
  );
}

/* ─────────────────────────────────────────────
   SVG 4 — Approval checkmark badge
   Floats right of the card
───────────────────────────────────────────── */
function ApprovalBadge() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="80" height="80" rx="16" fill="#f0fdf4" />
      {/* outer ring */}
      <circle
        cx="40"
        cy="38"
        r="20"
        stroke="#bbf7d0"
        strokeWidth="1.5"
        fill="#fff"
      />
      {/* check */}
      <path
        d="M28 38 L36 46 L53 30"
        stroke="#22c55e"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* label */}
      <text
        x="40"
        y="68"
        textAnchor="middle"
        fill="#22c55e"
        fontSize="6"
        fontWeight="700"
        fontFamily="sans-serif"
      >
        APPROVED
      </text>
    </svg>
  );
}

/* ─────────────────────────────────────────────
   SVG 5 — Two-person team icon
   Small, bottom-left of card
───────────────────────────────────────────── */
function TeamIcon() {
  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="52" height="52" rx="12" fill="#eff6ff" />
      {/* person 1 */}
      <circle cx="20" cy="18" r="6" fill="#bfdbfe" />
      <path d="M8 38 C8 30 32 30 32 38" fill="#bfdbfe" />
      {/* person 2 (overlapping) */}
      <circle cx="32" cy="18" r="6" fill="#3b82f6" />
      <path d="M20 38 C20 30 44 30 44 38" fill="#3b82f6" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   SVG 6 — Laptop / device icon
   Small, bottom-right of card
───────────────────────────────────────────── */
function LaptopIcon() {
  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="52" height="52" rx="12" fill="#eff6ff" />
      {/* screen */}
      <rect
        x="11"
        y="14"
        width="30"
        height="20"
        rx="3"
        fill="#fff"
        stroke="#bfdbfe"
        strokeWidth="1.2"
      />
      {/* screen content lines */}
      <rect x="15" y="18" width="14" height="2.5" rx="1" fill="#bfdbfe" />
      <rect x="15" y="22" width="10" height="2.5" rx="1" fill="#dbeafe" />
      <rect x="15" y="26" width="18" height="2.5" rx="1" fill="#dbeafe" />
      {/* active cell on screen */}
      <rect x="30" y="22" width="7" height="5" rx="1" fill="#3b82f6" />
      {/* base */}
      <rect x="8" y="34" width="36" height="4" rx="2" fill="#bfdbfe" />
      <rect x="18" y="34" width="16" height="2" rx="1" fill="#93c5fd" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Main component
───────────────────────────────────────────── */
export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter both email and password");
      return;
    }
    setIsLoading(true);
    try {
      const user = await login({ email: email.trim().toLowerCase(), password });
      const from = location.state?.from?.pathname;
      let redirectPath;
      if (from && from !== "/login") {
        redirectPath = from;
      } else {
        redirectPath =
          user.role === "ADMIN"
            ? "/admin"
            : user.role === "MANAGER"
              ? "/manager"
              : user.role === "EMPLOYEE"
                ? "/employee"
                : "/";
      }
      navigate(redirectPath, { replace: true });
      toast.success("Logged in successfully!");
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        "Log in failed. Please try again.";
      toast.error(message);
      console.error("Log in failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen px-4"
      style={{
        background: "#f8faff",
        backgroundImage: "radial-gradient(#dbeafe 1px, transparent 1px)",
        backgroundSize: "26px 26px",
      }}
    >
      {/* ── Outer wrapper — positions side graphics relative to card ── */}
      <div className="relative w-full max-w-md">
        {/* Left floating graphics */}
        <div className="absolute -left-28 top-1/2 -translate-y-1/2 flex flex-col gap-4 items-center opacity-90 hidden lg:flex">
          <WeeklyChart />
          <TeamIcon />
        </div>

        {/* Right floating graphics */}
        <div className="absolute -right-28 top-1/2 -translate-y-1/2 flex flex-col gap-4 items-center opacity-90 hidden lg:flex">
          <ApprovalBadge />
          <LaptopIcon />
        </div>

        {/* Timesheet icon above card */}
        <div className="flex justify-center mb-4">
          <TimesheetIcon />
        </div>

        <Card className="relative shadow-md border border-blue-100 bg-white/95">
          {/* Clock accent — top-right corner */}
          <div className="absolute -top-3 -right-3">
            <ClockAccent />
          </div>

          {/* AIS Logo — top-left */}
          <div className="absolute top-7 left-4 w-20 h-20 flex items-center justify-center">
            <img
              src={ais_logo}
              alt="AIS Logo"
              className="w-full h-full object-contain scale-120"
            />
          </div>

          <CardHeader className="space-y-1 text-center pt-8">
            <CardTitle className="text-3xl font-bold">TimeTrack</CardTitle>
            <CardDescription>Login to your account to continue</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="text-sm font-medium block mb-1"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-slate-50 focus-visible:ring-blue-400"
                    disabled={isLoading}
                    autoComplete="email"
                    aria-label="Email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="text-sm font-medium block mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-slate-50 focus-visible:ring-blue-400"
                    disabled={isLoading}
                    autoComplete="current-password"
                    aria-label="Password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
