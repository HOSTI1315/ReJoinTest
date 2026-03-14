import React from "react";
import { useAccounts } from "../state/useAccounts";
import { useAccountStatus } from "../state/useAccountStatus";
import { useRejoinStatus } from "../state/useRejoinStatus";
import { Modal } from "../components/Modal";
import { Card } from "../components/Card";
import type { Account } from "../api/client";
import { useSettings } from "../state/useSettings";
import { api } from "../api/client";

type FormMode = "add" | "edit";

export const AccountsPage: React.FC = () => {
  const statusMap = useAccountStatus();
  const { settings } = useSettings();
  const { running, toggle, loading: statusLoading, error: statusError } = useRejoinStatus();
  const [killLoading, setKillLoading] = React.useState(false);
  const {
    accounts,
    loading,
    error,
    addAccount,
    updateAccount,
    toggleAccount,
    deleteAccount
  } = useAccounts();

  const [formMode, setFormMode] = React.useState<FormMode | null>(null);
  const [editing, setEditing] = React.useState<Account | null>(null);
  const [cookie, setCookie] = React.useState("");
  const [placeId, setPlaceId] = React.useState("");
  const [vipLink, setVipLink] = React.useState("");
  const [submitLoading, setSubmitLoading] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [localStatusError, setLocalStatusError] = React.useState<string | null>(null);

  const resetForm = React.useCallback(() => {
    setFormMode(null);
    setEditing(null);
    setCookie("");
    setPlaceId("");
    setVipLink("");
    setSubmitError(null);
  }, []);

  const handleOpenAdd = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setFormMode("add");
      setEditing(null);
      setPlaceId("");
      setVipLink("");
      setSubmitError(null);
    },
    []
  );

  const handleOpenEdit = React.useCallback((acc: Account) => {
    setFormMode("edit");
    setEditing(acc);
    setCookie("");
    setPlaceId(acc.PlaceId);
    setVipLink(acc.PrivatSr ?? "");
    setSubmitError(null);
  }, []);

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitError(null);
      setSubmitLoading(true);

      try {
        if (formMode === "add") {
          await addAccount({
            cookie: cookie.trim(),
            placeId: placeId.trim(),
            vipLink: vipLink.trim() || undefined
          });
          resetForm();
        } else if (formMode === "edit" && editing) {
          await updateAccount(editing.id, {
            cookie: cookie.trim() || undefined,
            placeId: placeId.trim(),
            vipLink: vipLink.trim() || undefined
          });
          resetForm();
        }
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Ошибка");
      } finally {
        setSubmitLoading(false);
      }
    },
    [formMode, editing, cookie, placeId, vipLink, addAccount, updateAccount, resetForm]
  );

  const handleToggle = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>, id: number, current: boolean) => {
      e.stopPropagation();
      const next = !current;
      try {
        await toggleAccount(id, next);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Ошибка");
      }
    },
    [toggleAccount]
  );

  const handleDelete = React.useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>, id: number) => {
      e.stopPropagation();
      if (!window.confirm("Удалить аккаунт?")) return;
      try {
        await deleteAccount(id);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Ошибка удаления");
      }
    },
    [deleteAccount]
  );

  const handleCookieChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setCookie(e.target.value);
  const handlePlaceIdChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setPlaceId(e.target.value);
  const handleVipLinkChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setVipLink(e.target.value);

  const handleToggleRejoin = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setLocalStatusError(null);
    toggle();
  };

  const handleKillAll = React.useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setLocalStatusError(null);
      if (!window.confirm("Закрыть все окна Roblox?")) return;
      setKillLoading(true);
      try {
        const { killed } = await api.killAllRoblox();
        if (killed > 0) {
          window.alert(`Закрыто процессов: ${killed}`);
        }
      } catch (err) {
        setLocalStatusError(err instanceof Error ? err.message : "Ошибка");
      } finally {
        setKillLoading(false);
      }
    },
    []
  );

  const modalTitle = formMode === "add" ? "Добавить аккаунт" : "Изменить аккаунт";

  const totalAccounts = accounts.length;
  const enabledCount = accounts.filter((a) => a.enabled ?? true).length;
  const deadCount = accounts.filter((a) => a.dead).length;
  const validCookieCount = totalAccounts - deadCount;
  const onlineCount = accounts.filter(
    (a) => statusMap[String(a.id)]?.status === "in_game"
  ).length;
  const restartingCount = accounts.filter(
    (a) => statusMap[String(a.id)]?.status === "restarting"
  ).length;
  const offlineCount = Math.max(
    0,
    enabledCount - onlineCount - restartingCount
  );

  return (
    <section>
      <div
        className="page-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16
        }}
      >
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Аккаунты
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="form-label">ReJoin:</span>
            {statusLoading ? (
              <span className="skeleton" style={{ width: 80, height: 24 }} />
            ) : (
              <span
                className={`status-badge ${running ? "active" : "inactive"}`}
              >
                {running ? "Запущен" : "Остановлен"}
              </span>
            )}
            <button
              type="button"
              className={running ? "btn-danger btn-sm" : "btn-sm"}
              onClick={handleToggleRejoin}
              disabled={statusLoading}
            >
              {statusLoading
                ? "Загрузка…"
                : running
                ? "Остановить"
                : "Запустить"}
            </button>
          </div>
          <button
            type="button"
            className="btn-danger btn-sm"
            onClick={handleKillAll}
            disabled={killLoading}
            title="Закрыть все окна Roblox"
          >
            {killLoading ? "Выполняется…" : "Kill roblox"}
          </button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {(statusError || localStatusError) && (
        <p className="error">{localStatusError ?? statusError}</p>
      )}
      {!loading && totalAccounts > 0 && (
        <div className="accounts-stats">
          <div className="accounts-stat-card">
            <div className="accounts-stat-label">Аккаунты</div>
            <div className="accounts-stat-value">
              {enabledCount} / {totalAccounts}
            </div>
            <div className="accounts-stat-hint">Включено / всего</div>
          </div>
          <div className="accounts-stat-card">
            <div className="accounts-stat-label">В игре</div>
            <div className="accounts-stat-value">{onlineCount}</div>
            <div className="accounts-stat-hint">Сейчас в сессии</div>
          </div>
          <div className="accounts-stat-card">
            <div className="accounts-stat-label">Ожидают</div>
            <div className="accounts-stat-value">{offlineCount}</div>
            <div className="accounts-stat-hint">Не в игре</div>
          </div>
          <div className="accounts-stat-card">
            <div className="accounts-stat-label">Перезапуск</div>
            <div className="accounts-stat-value">{restartingCount}</div>
            <div className="accounts-stat-hint">В очереди ReJoin</div>
          </div>
          <div className="accounts-stat-card">
            <div className="accounts-stat-label">Куки</div>
            <div className="accounts-stat-value">
              {validCookieCount} / {deadCount}
            </div>
            <div className="accounts-stat-hint">Валидные / мёртвые</div>
          </div>
        </div>
      )}
      {loading && (
        <div className="card-grid">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="card-tile">
              <div className="skeleton" style={{ width: "60%" }} />
              <div className="skeleton" style={{ width: "40%" }} />
            </Card>
          ))}
        </div>
      )}

      {!loading && (
        <div className="card-grid">
          <button
            type="button"
            className="card card-tile add-tile"
            onClick={handleOpenAdd}
          >
            + Добавить аккаунт
          </button>
          {accounts.map((acc, index) => {
            const enabled = acc.enabled ?? true;
            const streamerMode = settings?.STREAMER_MODE ?? false;
            const displayName = streamerMode ? `Аккаунт ${index + 1}` : acc.name;
            return (
            <Card key={acc.id} className={`card-tile ${!enabled ? "card-tile-disabled" : ""}`}>
              <div className="card-tile-header">
                <span className="card-tile-title">
                  <span
                    className={`card-tile-status card-tile-status-${(statusMap[String(acc.id)]?.status) ?? "not_in_game"}`}
                    title={
                      (statusMap[String(acc.id)]?.status) === "in_game"
                        ? "В игре"
                        : (statusMap[String(acc.id)]?.status) === "restarting"
                        ? "Запуск/перезапуск"
                        : "Не в игре"
                    }
                    aria-hidden
                  />
                  {displayName}
                  {acc.dead && (
                    <span className="account-dead-icon" title="Мёртвая кука">
                      ☠
                    </span>
                  )}
                  {(statusMap[String(acc.id)]?.processName || statusMap[String(acc.id)]?.pid != null) && (
                    <span className="card-tile-process">
                      {[
                        statusMap[String(acc.id)]?.processName,
                        statusMap[String(acc.id)]?.pid != null
                          ? `PID: ${statusMap[String(acc.id)]?.pid}`
                          : null
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>
                <label className="toggle" aria-label={`${displayName}: ${enabled ? "включён" : "выключен"}`}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => handleToggle(e, acc.id, enabled)}
                    onClick={(e) => e.stopPropagation()}
                    title={enabled ? "Отключить" : "Включить"}
                    aria-checked={enabled}
                  />
                  <span className="toggle-slider" aria-hidden />
                  <span className="toggle-label">{enabled ? "Вкл" : "Выкл"}</span>
                </label>
              </div>
              <p className="card-tile-meta">
                Place: {acc.PlaceId} · {acc.PrivatSr ? "VIP" : "обычный"}
              </p>
              <div className="card-tile-actions">
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => handleOpenEdit(acc)}
                >
                  Изменить
                </button>
                <button
                  type="button"
                  className="btn-danger btn-sm"
                  onClick={(e) => handleDelete(e, acc.id)}
                >
                  Удалить
                </button>
              </div>
            </Card>
          );
          })}
        </div>
      )}

      <Modal
        open={formMode !== null}
        onClose={resetForm}
        title={modalTitle}
      >
        <form onSubmit={handleSubmit} className="form">
          {submitError && <p className="error">{submitError}</p>}
          <div className="form-row">
            <label className="form-label" htmlFor="modal-cookie">
              Cookie (.ROBLOSECURITY)
            </label>
            <input
              id="modal-cookie"
              type="password"
              value={cookie}
              onChange={handleCookieChange}
              placeholder={
                formMode === "edit"
                  ? "Оставьте пустым, чтобы не менять"
                  : "Вставьте cookie"
              }
              required={formMode === "add"}
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="modal-place">
              Place ID
            </label>
            <input
              id="modal-place"
              type="text"
              value={placeId}
              onChange={handlePlaceIdChange}
              placeholder="Place ID"
              required
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="modal-vip">
              VIP-ссылка
            </label>
            <input
              id="modal-vip"
              type="text"
              value={vipLink}
              onChange={handleVipLinkChange}
              placeholder="Ссылка на приватный сервер"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={resetForm}>
              Отмена
            </button>
            <button type="submit" disabled={submitLoading}>
              {submitLoading ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
};
