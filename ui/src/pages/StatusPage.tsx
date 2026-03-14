import React from "react";
import { useRejoinStatus } from "../state/useRejoinStatus";
import { useSettings } from "../state/useSettings";
import { api } from "../api/client";
import { Card } from "../components/Card";

const INJECTOR_POLL_MS = 8000;

export const StatusPage: React.FC = () => {
  const { running, toggle, loading, error } = useRejoinStatus();
  const { settings } = useSettings();
  const trackInjector = settings?.TRACK_INJECTOR ?? false;
  const [injectorStatus, setInjectorStatus] = React.useState<{
    running: boolean;
    pid: number | null;
  } | null>(null);

  React.useEffect(() => {
    if (!trackInjector) {
      setInjectorStatus(null);
      return;
    }
    let cancelled = false;
    const poll = () => {
      api
        .getInjectorStatus()
        .then((data) => {
          if (!cancelled && data.tracking && data.running !== undefined) {
            setInjectorStatus({
              running: data.running,
              pid: data.pid ?? null
            });
          }
        })
        .catch(() => {
          if (!cancelled) setInjectorStatus(null);
        });
    };
    poll();
    const id = setInterval(poll, INJECTOR_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [trackInjector]);
  const [killLoading, setKillLoading] = React.useState(false);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    toggle();
  };

  const handleKillAll = React.useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (!window.confirm("Закрыть все окна Roblox?")) return;
      setKillLoading(true);
      try {
        const { killed } = await api.killAllRoblox();
        if (killed > 0) {
          window.alert(`Закрыто процессов: ${killed}`);
        }
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Ошибка");
      } finally {
        setKillLoading(false);
      }
    },
    []
  );

  return (
    <section>
      <h1 className="page-title">Статус</h1>
      {error && <p className="error">{error}</p>}
      <Card>
        <div className="status-card">
          <div className="status-row">
            <span className="form-label">ReJoin</span>
            {loading ? (
              <span className="skeleton" style={{ width: 80, height: 28 }} />
            ) : (
              <span
                className={`status-badge ${running ? "active" : "inactive"}`}
              >
                {running ? "Запущен" : "Остановлен"}
              </span>
            )}
          </div>
          <button
            type="button"
            className={running ? "btn-danger" : ""}
            onClick={handleToggle}
            disabled={loading}
          >
            {loading ? "Загрузка…" : running ? "Остановить" : "Запустить"}
          </button>
        </div>
        <div className="status-card" style={{ marginTop: 16 }}>
          <div className="status-row">
            <span className="form-label">Roblox</span>
          </div>
          <button
            type="button"
            className="btn-danger"
            onClick={handleKillAll}
            disabled={killLoading}
          >
            {killLoading ? "Выполняется…" : "Kill all roblox"}
          </button>
        </div>
        {trackInjector && (
          <div className="status-card" style={{ marginTop: 16 }}>
            <div className="status-row">
              <span className="form-label">Инжектор</span>
              {injectorStatus === null ? (
                <span className="skeleton" style={{ width: 80, height: 28 }} />
              ) : (
                <span
                  className={`status-badge ${injectorStatus.running ? "active" : "inactive"}`}
                >
                  {injectorStatus.running
                    ? `Запущен${injectorStatus.pid ? ` (${injectorStatus.pid})` : ""}`
                    : "Не запущен"}
                </span>
              )}
            </div>
          </div>
        )}
      </Card>
    </section>
  );
};
