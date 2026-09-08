import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Lenis from "lenis";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext";
import { Button } from "./ui/button";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ClipboardList,
  Ticket as TicketIcon,
  ListChecks,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  User,
  ChevronUp,
  ListTodo,
} from "lucide-react";
import ais_logo from "../assets/ais_logo.png";
// import ais_logo_dark from "../assets/ais_logo_dark.png"; // Dark mode logo
import { ThemeToggle } from "./ThemeToggle";

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const wrapper = document.querySelector('.main-scroll-area');
    if (!wrapper) return;

    const lenis = new Lenis({
      wrapper,
      content: wrapper.firstElementChild || wrapper,
      lerp: 0.08,
      duration: 1.2,
      smoothWheel: true,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const rafId = requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleProfileClick = () => {
    navigate("/profile");
    setUserMenuOpen(false);
  };

  // Helper function to get user initials
  const getUserInitials = (name) => {
    if (!name) return "U";
    const names = name.trim().split(" ");
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    return (
      names[0].charAt(0) + names[names.length - 1].charAt(0)
    ).toUpperCase();
  };

  const navigation = {
    ADMIN: [
      { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { name: "User Management", href: "/admin/users", icon: Users },
      { name: "Client Management", href: "/admin/clients", icon: Briefcase },
      {
        name: "Project Management",
        href: "/admin/projects",
        icon: ClipboardList,
      },
      {
        name: "Ticket Management",
        href: "/admin/tickets",
        icon: TicketIcon,
      },
      { name: "Task Management", href: "/admin/tasks", icon: ListTodo },
      {
        name: "Ticket Assignments",
        href: "/admin/assignments",
        icon: ListChecks,
      },
      { name: "Approvals", href: "/admin/timesheet-approval", icon: FileText },
      { name: "Reports", href: "/admin/reports", icon: BarChart3 },
      { name: "Settings", href: "/admin/settings", icon: Settings },
    ],
    MANAGER: [
      { name: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
      { name: "My Tickets", href: "/manager/my-tickets", icon: TicketIcon },
      {
        name: "Ticket Management",
        href: "/manager/tickets",
        icon: TicketIcon,
      },
      {
        name: "Assign Tickets",
        href: "/manager/assignments",
        icon: ListChecks,
      },
      { name: "Timesheet Entry", href: "/manager/timesheet", icon: FileText },
      { name: "Approvals", href: "/manager/approvals", icon: ListChecks },
      {
        name: "My History",
        href: "/manager/history",
        icon: ClipboardList,
      },
      { name: "Reports", href: "/manager/reports", icon: BarChart3 },
    ],
    EMPLOYEE: [
      { name: "Dashboard", href: "/employee/dashboard", icon: LayoutDashboard },
      {
        name: "My Tickets",
        href: "/employee/my-tickets",
        icon: TicketIcon,
      },
      {
        name: "Timesheet Entry",
        href: "/employee/timesheet",
        icon: FileText,
      },
      {
        name: "Timesheet History",
        href: "/employee/history",
        icon: ClipboardList,
      },
    ],
  };

  const currentNav = user ? navigation[user.role] || [] : [];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } bg-white/80 backdrop-blur-xl border-r border-zinc-200/60 dark:bg-zinc-950/90 dark:backdrop-blur-xl dark:border-zinc-800/40 w-64 flex flex-col`}
      >
        {/* Logo Section */}
        <div className="flex items-center gap-3 px-6 pt-8 pb-6">
          {/* Logo container with a polished white card look to hide awkward image backgrounds */}
          <div className="w-12 h-12 flex-shrink-0 bg-white dark:bg-white/90 rounded-xl shadow-sm p-1.5 flex items-center justify-center">
            <img
              src={ais_logo}
              alt="AIS Logo"
              className="w-full h-full object-contain mix-blend-multiply"
            />
          </div>

          {/* Text */}
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-bold tracking-tight text-primary dark:text-foreground leading-none mb-1">
              3TOne
            </h1>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {user?.role?.toLowerCase()}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {currentNav.map((item, index) => {
            const isActive = location.pathname === item.href;
            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04, duration: 0.25, ease: 'easeOut' }}
              >
                <Link
                  to={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 active:scale-[0.98] ${
                    isActive
                      ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary font-semibold border-l-2 border-primary"
                      : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* User Section with Dropdown */}
        <div className="p-4 relative mt-auto border-t border-zinc-100 dark:border-zinc-800/60 pt-2">
          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div
              className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-card border-[1.5px] border-[#070959] dark:border-border rounded-lg shadow-lg overflow-hidden"
            >
              <button
                onClick={handleProfileClick}
                className="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-700 dark:text-muted-foreground hover:bg-gray-50 dark:hover:bg-muted transition-colors"
              >
                <User className="w-4 h-4 mr-3" />
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-[#7f1d1d] transition-colors border-t border-gray-100 dark:border-border"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Logout
              </button>
            </div>
          )}

          {/* User Info Button */}
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-colors ${
              userMenuOpen 
                ? "bg-[#070959] dark:bg-primary text-white" 
                : "hover:bg-gray-50 dark:hover:bg-accent"
            }`}
          >
            {/* User Initials Circle */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                userMenuOpen
                  ? "bg-white text-[#070959] dark:text-primary"
                  : "bg-[#070959] dark:bg-primary text-white"
              }`}
            >
              {getUserInitials(user?.name)}
            </div>

            <div className="flex-1 min-w-0 text-left">
              <p
                className={`text-sm font-medium truncate ${
                  userMenuOpen
                    ? "text-white"
                    : "text-gray-900 dark:text-foreground"
                }`}
              >
                {user?.name}
              </p>
              <p
                className={`text-xs truncate ${
                  userMenuOpen
                    ? "text-gray-200"
                    : "text-gray-500 dark:text-muted-foreground"
                }`}
              >
                {user?.email}
              </p>
            </div>
            <ChevronUp
              className={`w-4 h-4 transition-transform ${
                userMenuOpen
                  ? "rotate-180 text-white"
                  : "text-gray-400 dark:text-muted-foreground"
              }`}
            />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 overflow-hidden ${
          sidebarOpen ? "lg:ml-64" : ""
        }`}
      >
        {/* The "App Frame" */}
        <div className="flex-1 flex flex-col m-0 lg:my-3 lg:mr-3 bg-white dark:bg-[#121214] lg:rounded-2xl shadow-soft lg:border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden relative">

        {/* Top bar */}
        <header className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-800/50 sticky top-0 z-30 flex items-center justify-between px-6 py-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hover:bg-gray-100 dark:hover:bg-accent"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-gray-700 dark:text-foreground" />
            ) : (
              <Menu className="w-5 h-5 text-gray-700 dark:text-foreground" />
            )}
          </Button>

          <div className="flex-1 px-4">
            <motion.h2
              key={location.pathname}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="text-base font-semibold text-foreground"
            >
              {currentNav.find((item) => item.href === location.pathname)
                ?.name || "Dashboard"}
            </motion.h2>
          </div>

          <div className="flex items-center space-x-2">
            {/* Theme Toggle Button */}
            <ThemeToggle />

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="hover:bg-gray-100 dark:hover:bg-accent"
              onClick={() => navigate('/notifications')}
            >
              <Bell className="w-5 h-5 text-gray-700 dark:text-foreground" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 p-6 overflow-x-hidden overflow-y-auto main-scroll-area">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
