import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { Lock, Mail, Eye, EyeOff, ArrowRight } from "lucide-react";
import ais_logo from "../assets/ais_logo.png";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    try {
      setIsLoading(true);
      const user = await login({ email, password });

      toast.success("Login successful!", {
        description: `Welcome back, ${user.first_name || user.email}`,
      });

      const from = location.state?.from?.pathname;
      if (from && from !== "/") {
        navigate(from, { replace: true });
        return;
      }

      const redirectPath =
        user.role === "ADMIN"
          ? "/admin/dashboard"
          : user.role === "MANAGER"
            ? "/manager/dashboard"
            : user.role === "EMPLOYEE"
              ? "/employee/dashboard"
              : "/";
              
      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error("Log in failed:", err);
      toast.error(err?.response?.data?.error || err?.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left side: Brand / Abstract Visual ── */}
      <div className="hidden lg:flex w-1/2 bg-zinc-950 relative items-center justify-center overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] -top-40 -left-40 mix-blend-screen pointer-events-none" />
        <div className="absolute w-[600px] h-[600px] bg-violet-600/20 rounded-full blur-[100px] bottom-0 right-0 mix-blend-screen pointer-events-none" />
        
        {/* Abstract geometric grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="relative z-10 text-center px-12 max-w-2xl text-white">
          <div className="inline-flex items-center justify-center p-3 bg-white/10 backdrop-blur-md rounded-2xl mb-8 border border-white/10 shadow-2xl">
            <img
              src={ais_logo}
              alt="AIS Logo"
              className="w-16 h-16 object-contain brightness-0 invert opacity-90"
            />
          </div>
          <h2 className="text-5xl font-bold tracking-tight mb-6 bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-transparent">
            Enterprise Time Management
          </h2>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-lg mx-auto">
            Streamline your workforce tracking with zero friction. Built for modern teams who demand performance and precision.
          </p>
        </div>
      </div>

      {/* ── Right side: Login Form ── */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 relative">
        <div className="w-full max-w-md space-y-8 relative z-10">
          
          <div className="text-center lg:text-left">
            {/* Mobile-only logo */}
            <div className="lg:hidden w-16 h-16 bg-white rounded-2xl shadow-soft p-2 mb-8 mx-auto border border-zinc-100 dark:border-zinc-800">
               <img src={ais_logo} alt="AIS Logo" className="w-full h-full object-contain" />
            </div>
            
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Enter your credentials to access your dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 mt-8" noValidate>
            <div className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground"
                >
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 bg-background"
                    disabled={isLoading}
                    autoComplete="email"
                    aria-label="Email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-foreground"
                  >
                    Password
                  </label>
                  <a href="#" className="text-sm font-medium text-primary hover:underline" tabIndex={-1}>
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 bg-background"
                    disabled={isLoading}
                    autoComplete="current-password"
                    aria-label="Password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 text-base mt-2 group relative overflow-hidden" 
              disabled={isLoading}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isLoading ? "Signing in…" : "Sign In"}
                {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </span>
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}
