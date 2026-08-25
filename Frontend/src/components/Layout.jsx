import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 dark:bg-[#1a1a1a]">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen transition-transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } bg-white dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-[#404040] w-64 flex flex-col`}
      >
        {/* Logo Section */}
        <div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-[#404040]">
          {/* Logo - switches based on theme */}
          <div className="w-20 h-20 flex-shrink-0">
            <img
              src={theme === "dark" ? ais_logo : ais_logo}
              alt="AIS Logo"
              className="w-full h-full object-contain transition-opacity duration-300"
            />
          </div>

          {/* Text */}
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-[#f0f4ff]">
              TimeTrack
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
              {user?.role?.toLowerCase()}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {currentNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                  isActive
                    ? "bg-primary dark:bg-[#3b4bff] text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2d2d2d]"
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Section with Dropdown */}
        <div className="p-4 border-t border-gray-200 dark:border-[#404040] relative">
          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div
              className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-[#2d2d2d] border rounded-lg shadow-lg overflow-hidden"
              style={{
                borderColor: theme === "dark" ? "#404040" : "#070959",
                borderWidth: "1.5px",
              }}
            >
              <button
                onClick={handleProfileClick}
                className="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1f1f1f] transition-colors"
              >
                <User className="w-4 h-4 mr-3" />
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-[#7f1d1d] transition-colors border-t border-gray-100 dark:border-[#404040]"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Logout
              </button>
            </div>
          )}

          {/* User Info Button */}
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={
              userMenuOpen
                ? {
                    backgroundColor: theme === "dark" ? "#3b4bff" : "#070959",
                    color: "white",
                  }
                : {}
            }
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-colors ${
              userMenuOpen ? "" : "hover:bg-gray-50 dark:hover:bg-[#2d2d2d]"
            }`}
            onMouseEnter={(e) => {
              if (userMenuOpen) {
                e.currentTarget.style.backgroundColor =
                  theme === "dark" ? "#3b4bff" : "#070959";
                e.currentTarget.style.transform = "none";
              }
            }}
          >
            {/* User Initials Circle */}
            <div
              style={
                userMenuOpen
                  ? {
                      backgroundColor: "white",
                      color: theme === "dark" ? "#3b4bff" : "#070959",
                    }
                  : {
                      backgroundColor: theme === "dark" ? "#3b4bff" : "#070959",
                      color: "white",
                    }
              }
              className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors"
            >
              {getUserInitials(user?.name)}
            </div>

            <div className="flex-1 min-w-0 text-left">
              <p
                className={`text-sm font-medium truncate ${
                  userMenuOpen
                    ? "text-white"
                    : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {user?.name}
              </p>
              <p
                className={`text-xs truncate ${
                  userMenuOpen
                    ? "text-gray-200"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {user?.email}
              </p>
            </div>
            <ChevronUp
              className={`w-4 h-4 transition-transform ${
                userMenuOpen
                  ? "rotate-180 text-white"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          sidebarOpen ? "ml-64" : "ml-0"
        } transition-all overflow-hidden`}
      >
        {/* Top bar */}
        <header className="bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-[#404040] sticky top-0 z-30 flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hover:bg-gray-100 dark:hover:bg-[#2d2d2d]"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            ) : (
              <Menu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            )}
          </Button>

          <div className="flex-1 px-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {currentNav.find((item) => item.href === location.pathname)
                ?.name || "Dashboard"}
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            {/* Theme Toggle Button */}
            <ThemeToggle />

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-gray-100 dark:hover:bg-[#2d2d2d]"
            >
              <Bell className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 p-6 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-[#0b0b29]">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
