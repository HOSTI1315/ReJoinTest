import React from "react";
import { SettingsProvider } from "./context/SettingsContext";
import { ThemeApplicator } from "./components/ThemeApplicator";
import { Sidebar, type View } from "./components/Sidebar";
import { AccountsPage } from "./pages/AccountsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AutoExecPage } from "./pages/AutoExecPage";
import { WorkspacePage } from "./pages/WorkspacePage";

export const App: React.FC = () => {
  const [view, setView] = React.useState<View>("accounts");

  return (
    <SettingsProvider>
      <ThemeApplicator />
      <div className="app-root">
        <Sidebar current={view} onChange={setView} />
        <main className="app-main">
          {view === "accounts" && <AccountsPage />}
          {view === "autoexec" && <AutoExecPage />}
          {view === "workspace" && <WorkspacePage />}
          {view === "settings" && <SettingsPage />}
        </main>
      </div>
    </SettingsProvider>
  );
};

