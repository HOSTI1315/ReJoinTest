import type React from "react";
import { useSettingsContext } from "../context/SettingsContext";

export type View = "accounts" | "settings" | "autoexec" | "workspace";

interface SidebarProps {
  current: View;
  onChange: (view: View) => void;
}

const NAV_ITEMS: { id: View; label: string }[] = [
  { id: "accounts", label: "Аккаунты" },
  { id: "autoexec", label: "AutoExec" },
  { id: "workspace", label: "Workspace" },
  { id: "settings", label: "Настройки" }
];

export const Sidebar: React.FC<SidebarProps> = ({ current, onChange }) => {
  const { settings, save } = useSettingsContext();

  const handleNav = (e: React.MouseEvent<HTMLButtonElement>, view: View) => {
    e.preventDefault();
    onChange(view);
  };

  const handleThemeToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!settings) return;
    const nextTheme = settings.THEME === "dark" ? "light" : "dark";
    save({ ...settings, THEME: nextTheme }).catch(() => {});
  };

  const themeLabel = settings?.THEME === "dark" ? "Светлая" : "Тёмная";

  return (
    <aside className="sidebar">
      <h1 className="sidebar-title">SkrilyaReJoinTool</h1>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`nav-btn ${current === id ? "active" : ""}`}
            onClick={(e) => handleNav(e, id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          type="button"
          className="nav-btn sidebar-theme-btn"
          onClick={handleThemeToggle}
          disabled={!settings}
          title={`Переключить на ${themeLabel} тему`}
        >
          {themeLabel}
        </button>
      </div>
    </aside>
  );
};

