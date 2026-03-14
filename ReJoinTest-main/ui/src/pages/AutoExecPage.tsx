import React from "react";
import { api } from "../api/client";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import { ScriptEditor } from "../components/ScriptEditor";
import type { Script, ScriptType } from "../api/client";

export const AutoExecPage: React.FC = () => {
  const [scripts, setScripts] = React.useState<Script[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [syncLoading, setSyncLoading] = React.useState(false);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingScript, setEditingScript] = React.useState<Script | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editContent, setEditContent] = React.useState("");
  const [saveLoading, setSaveLoading] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const type: ScriptType = "autoexec";

  const load = React.useCallback(() => {
    setLoading(true);
    api
      .getScripts(type)
      .then((data) => {
        setScripts(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || "Ошибка загрузки");
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleSync = React.useCallback(async () => {
    setSyncLoading(true);
    try {
      const data = await api.syncScripts(type);
      setScripts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка синхронизации");
    } finally {
      setSyncLoading(false);
    }
  }, []);

  const filteredScripts = scripts.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  const handleOpenNew = React.useCallback(() => {
    setEditingScript(null);
    setEditName("");
    setEditContent("");
    setSaveError(null);
    setEditorOpen(true);
  }, []);

  const handleOpenEdit = React.useCallback((s: Script) => {
    setEditingScript(s);
    setEditName(s.name.replace(/\.lua$/i, ""));
    setEditContent(s.content);
    setSaveError(null);
    setEditorOpen(true);
  }, []);

  const handleCloseEditor = React.useCallback(() => {
    setEditorOpen(false);
    setEditingScript(null);
  }, []);

  const handleSave = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSaveError(null);
      setSaveLoading(true);
      try {
        const name = editName.trim() || "script";
        await api.saveScript(type, {
          name: name.endsWith(".lua") ? name : `${name}.lua`,
          content: editContent
        });
        load();
        handleCloseEditor();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Ошибка сохранения");
      } finally {
        setSaveLoading(false);
      }
    },
    [editName, editContent, load, handleCloseEditor]
  );

  const handleDelete = React.useCallback(
    async (e: React.MouseEvent, s: Script) => {
      e.stopPropagation();
      if (!window.confirm(`Удалить "${s.name}"?`)) return;
      try {
        await api.deleteScript(type, s.id);
        load();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Ошибка удаления");
      }
    },
    [load]
  );

  return (
    <section>
      <div className="scripts-page-header">
        <h1 className="page-title">AutoExec</h1>
        <div className="scripts-actions">
          <input
            type="text"
            className="scripts-search"
            placeholder="Поиск скриптов…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="btn-ghost"
            onClick={handleSync}
            disabled={syncLoading}
          >
            {syncLoading ? "Синхронизация…" : "Синхронизировать"}
          </button>
          <button type="button" onClick={handleOpenNew}>
            + Новый скрипт
          </button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <p className="scripts-count">{filteredScripts.length} скриптов</p>
      {loading ? (
        <Card>
          <div className="skeleton" style={{ height: 120 }} />
        </Card>
      ) : filteredScripts.length === 0 ? (
        <Card className="scripts-empty">
          <p className="scripts-empty-text">Нет скриптов</p>
          <p className="scripts-empty-hint">
            Создайте скрипт, чтобы начать
          </p>
          <button type="button" onClick={handleOpenNew}>
            + Новый скрипт
          </button>
        </Card>
      ) : (
        <div className="card-grid">
          {filteredScripts.map((s) => (
            <div
              key={s.id}
              className="card card-tile scripts-tile"
              role="button"
              tabIndex={0}
              onClick={() => handleOpenEdit(s)}
              onKeyDown={(e) => e.key === "Enter" && handleOpenEdit(s)}
            >
              <span className="card-tile-title">{s.name}</span>
              <div className="card-tile-actions">
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(s);
                  }}
                >
                  Изменить
                </button>
                <button
                  type="button"
                  className="btn-danger btn-sm"
                  onClick={(e) => handleDelete(e, s)}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={handleCloseEditor}
        title={editingScript ? "Редактировать скрипт" : "Новый скрипт"}
      >
        <form onSubmit={handleSave} className="form">
          {saveError && <p className="error">{saveError}</p>}
          <div className="form-row">
            <label className="form-label" htmlFor="script-name">
              Имя
            </label>
            <input
              id="script-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="script (сохранится как script.lua)"
            />
          </div>
          <div className="form-row">
            <label className="form-label">Код (Lua)</label>
            <ScriptEditor
              value={editContent}
              onChange={setEditContent}
              height="320px"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={handleCloseEditor}>
              Отмена
            </button>
            <button type="submit" disabled={saveLoading}>
              {saveLoading ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
};
