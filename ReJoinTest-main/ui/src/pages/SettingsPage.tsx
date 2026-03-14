import React from "react";
import { useSettings } from "../state/useSettings";
import { Card } from "../components/Card";
import type { Settings } from "../api/client";

/**
 * Form initialized from settings. Uses key to reset when settings change
 * (per react-useeffect: reset state on prop change -> use key prop).
 */
const SettingsForm: React.FC<{
  initial: Settings;
  onSave: (s: Settings) => void | Promise<void>;
}> = ({ initial, onSave }) => {
  const [interval, setInterval] = React.useState(initial.CHECK_INTERVAL);
  const [title, setTitle] = React.useState(initial.CUSTOM_TITLE);
  const [theme, setTheme] = React.useState<"light" | "dark">(
    initial.THEME === "light" ? "light" : "dark"
  );
  const [trackInjector, setTrackInjector] = React.useState(
    initial.TRACK_INJECTOR ?? false
  );
  const [injectorPath, setInjectorPath] = React.useState(
    initial.INJECTOR_PATH ?? ""
  );
  const [rejoinDelay, setRejoinDelay] = React.useState(
    initial.REJOIN_DELAY ?? 3
  );
  const [syncVolt, setSyncVolt] = React.useState(initial.SYNC_VOLT ?? true);
  const [syncSeliware, setSyncSeliware] = React.useState(
    initial.SYNC_SELIWARE ?? true
  );
  const [syncPotassium, setSyncPotassium] = React.useState(
    initial.SYNC_POTASSIUM ?? true
  );
  const [syncWave, setSyncWave] = React.useState(initial.SYNC_WAVE ?? true);
  const [streamerMode, setStreamerMode] = React.useState(
    initial.STREAMER_MODE ?? false
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setSaving(true);
      try {
        const next: Settings = {
          ...initial,
          CHECK_INTERVAL: interval,
          CUSTOM_TITLE: title,
          THEME: theme,
          LANG: initial.LANG,
          TRACK_INJECTOR: trackInjector,
          INJECTOR_PATH: injectorPath.trim(),
          REJOIN_DELAY: rejoinDelay,
          SYNC_VOLT: syncVolt,
          SYNC_SELIWARE: syncSeliware,
          SYNC_POTASSIUM: syncPotassium,
          SYNC_WAVE: syncWave,
          STREAMER_MODE: streamerMode
        };
        await onSave(next);
      } finally {
        setSaving(false);
      }
    },
    [initial, interval, title, theme, trackInjector, injectorPath, rejoinDelay, syncVolt, syncSeliware, syncPotassium, syncWave, streamerMode, onSave]
  );

  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setInterval(Number(e.target.value));
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setTitle(e.target.value);
  const handleThemeChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setTheme(e.target.checked ? "dark" : "light");
  const handleTrackInjectorChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setTrackInjector(e.target.checked);
  const handleInjectorPathChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setInjectorPath(e.target.value);
  const handleRejoinDelayChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setRejoinDelay(Number(e.target.value));
  const handleSyncVoltChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSyncVolt(e.target.checked);
  const handleSyncSeliwareChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSyncSeliware(e.target.checked);
  const handleSyncPotassiumChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSyncPotassium(e.target.checked);
  const handleSyncWaveChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSyncWave(e.target.checked);
  const handleStreamerModeChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setStreamerMode(e.target.checked);

  return (
    <form onSubmit={handleSubmit} className="form">
      {error && <p className="error">{error}</p>}
      <div className="form-row">
        <label className="form-label">Тема</label>
        <label className="toggle settings-theme-toggle" aria-label="Тёмная тема">
          <input
            type="checkbox"
            checked={theme === "dark"}
            onChange={handleThemeChange}
            aria-checked={theme === "dark"}
          />
          <span className="toggle-slider" aria-hidden />
          <span className="toggle-label">
            {theme === "dark" ? "Тёмная" : "Светлая"}
          </span>
        </label>
      </div>
      <div className="form-row">
        <label className="form-label" htmlFor="settings-interval">
          Интервал проверки (сек)
        </label>
        <input
          id="settings-interval"
          type="number"
          value={interval}
          onChange={handleIntervalChange}
          min={1}
          max={120}
        />
      </div>
      <div className="form-row">
        <label className="form-label">Отслеживать инжектор</label>
        <label className="toggle" aria-label="Отслеживать инжектор">
          <input
            type="checkbox"
            checked={trackInjector}
            onChange={handleTrackInjectorChange}
            aria-checked={trackInjector}
          />
          <span className="toggle-slider" aria-hidden />
          <span className="toggle-label">{trackInjector ? "Да" : "Нет"}</span>
        </label>
      </div>
      {trackInjector && (
        <div className="form-row settings-injector-path" style={{ marginTop: -8 }}>
          <label className="form-label" htmlFor="settings-injector-path">
            Путь к инжектору
          </label>
          <input
            id="settings-injector-path"
            type="text"
            value={injectorPath}
            onChange={handleInjectorPathChange}
            placeholder="C:\...\tauri-app.exe"
          />
        </div>
      )}
      <div className="form-row">
        <label className="form-label" htmlFor="settings-rejoin-delay">
          Задержка перезапуска (сек)
        </label>
        <input
          id="settings-rejoin-delay"
          type="number"
          value={rejoinDelay}
          onChange={handleRejoinDelayChange}
          min={0}
          max={30}
        />
      </div>
      <div className="form-row">
        <span className="form-label">Синхронизация скриптов</span>
      </div>
      <div className="form-row">
        <label className="toggle" aria-label="Синхронизировать Volt">
          <input
            type="checkbox"
            checked={syncVolt}
            onChange={handleSyncVoltChange}
            aria-checked={syncVolt}
          />
          <span className="toggle-slider" aria-hidden />
          <span className="toggle-label">Синхронизировать Volt</span>
        </label>
      </div>
      <div className="form-row">
        <label className="toggle" aria-label="Синхронизировать Seliware">
          <input
            type="checkbox"
            checked={syncSeliware}
            onChange={handleSyncSeliwareChange}
            aria-checked={syncSeliware}
          />
          <span className="toggle-slider" aria-hidden />
          <span className="toggle-label">Синхронизировать Seliware</span>
        </label>
      </div>
      <div className="form-row">
        <label className="toggle" aria-label="Синхронизировать Potassium">
          <input
            type="checkbox"
            checked={syncPotassium}
            onChange={handleSyncPotassiumChange}
            aria-checked={syncPotassium}
          />
          <span className="toggle-slider" aria-hidden />
          <span className="toggle-label">Синхронизировать Potassium</span>
        </label>
      </div>
      <div className="form-row">
        <label className="toggle" aria-label="Синхронизировать Wave">
          <input
            type="checkbox"
            checked={syncWave}
            onChange={handleSyncWaveChange}
            aria-checked={syncWave}
          />
          <span className="toggle-slider" aria-hidden />
          <span className="toggle-label">Синхронизировать Wave</span>
        </label>
      </div>
      <div className="form-row">
        <label className="form-label">Режим стримера</label>
        <label className="toggle" aria-label="Режим стримера (скрывать ники аккаунтов)">
          <input
            type="checkbox"
            checked={streamerMode}
            onChange={handleStreamerModeChange}
            aria-checked={streamerMode}
          />
          <span className="toggle-slider" aria-hidden />
          <span className="toggle-label">
            {streamerMode ? "Включён (ники скрыты)" : "Выключен"}
          </span>
        </label>
      </div>
      <button type="submit" disabled={saving}>
        {saving ? "Сохранение…" : "Сохранить"}
      </button>
    </form>
  );
};

export const SettingsPage: React.FC = () => {
  const { settings, loading, error, save } = useSettings();

  if (loading && !settings) {
    return (
      <section>
        <h1 className="page-title">Настройки</h1>
        <Card>
          <div className="skeleton" style={{ height: 40, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 40 }} />
        </Card>
      </section>
    );
  }

  if (error && !settings) {
    return (
      <section>
        <h1 className="page-title">Настройки</h1>
        <p className="error">{error}</p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="page-title">Настройки</h1>
      {error && <p className="error">{error}</p>}
      {settings && (
        <Card>
          <SettingsForm
            key={`${settings.CHECK_INTERVAL}-${settings.CUSTOM_TITLE}-${settings.THEME}-${settings.TRACK_INJECTOR}-${settings.INJECTOR_PATH}-${settings.REJOIN_DELAY ?? 3}-${settings.SYNC_VOLT ?? true}-${settings.SYNC_SELIWARE ?? true}-${settings.SYNC_POTASSIUM ?? true}-${settings.SYNC_WAVE ?? true}-${settings.STREAMER_MODE ?? false}`}
            initial={settings}
            onSave={save}
          />
        </Card>
      )}
    </section>
  );
};
