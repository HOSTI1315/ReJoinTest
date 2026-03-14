import React from "react";
import { api } from "../api/client";
import { Modal } from "../components/Modal";
import { ScriptEditor } from "../components/ScriptEditor";
import type { Script, ScriptType } from "../api/client";

interface TreeNode {
  name: string;
  relPath: string;
  type: "folder" | "file";
  children?: TreeNode[];
  script?: Script;
}

function buildTree(scripts: Script[]): TreeNode[] {
  const root: Record<string, TreeNode> = {};

  for (const s of scripts) {
    const relPath = s.name || (s as Script & { rel_path?: string }).rel_path || "";
    const parts = relPath.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length === 0) continue;

    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const pathSoFar = parts.slice(0, i + 1).join("/");
      const isFile = i === parts.length - 1;

      if (!current[part]) {
        current[part] = {
          name: part,
          relPath: pathSoFar,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : {},
        } as TreeNode;
        if (isFile) (current[part] as TreeNode).script = s;
      }
      if (!isFile && typeof (current[part] as TreeNode).children === "object") {
        current = (current[part] as TreeNode).children as Record<string, TreeNode>;
      }
    }
  }

  const toArray = (obj: Record<string, TreeNode>): TreeNode[] =>
    Object.values(obj)
      .map((n) => ({
        ...n,
        children: n.children && typeof n.children === "object"
          ? toArray(n.children as Record<string, TreeNode>)
          : undefined,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });

  return [{
    name: "Workspace",
    relPath: "",
    type: "folder",
    children: toArray(root),
  }];
}

const WorkspaceTreeItem: React.FC<{
  node: TreeNode;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (script: Script) => void;
  selectedPath: string | null;
  depth?: number;
}> = ({ node, expanded, onToggle, onSelect, selectedPath, depth = 0 }) => {
  const isExpanded = expanded.has(node.relPath);
  const isSelected = selectedPath === node.relPath;
  const hasChildren = node.children && node.children.length > 0;

  const handleClick = () => {
    if (node.type === "file" && node.script) {
      onSelect(node.script);
    } else if (node.type === "folder") {
      onToggle(node.relPath);
    }
  };

  return (
    <div className="workspace-tree-item">
      <div
        className={`workspace-tree-row ${isSelected ? "selected" : ""}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={handleClick}
        role="treeitem"
        aria-expanded={node.type === "folder" ? isExpanded : undefined}
      >
        <span className="workspace-tree-chevron" aria-hidden>
          {node.type === "folder" && hasChildren ? (isExpanded ? "▾" : "▸") : ""}
        </span>
        <span className="workspace-tree-label">{node.name}</span>
      </div>
      {node.type === "folder" && isExpanded && node.children && (
        <div className="workspace-tree-children">
          {node.children.map((child) => (
            <WorkspaceTreeItem
              key={child.relPath}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedPath={selectedPath}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const WorkspacePage: React.FC = () => {
  const [scripts, setScripts] = React.useState<Script[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [syncLoading, setSyncLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<Script | null>(null);
  const [editContent, setEditContent] = React.useState("");
  const [editName, setEditName] = React.useState("");
  const [saveLoading, setSaveLoading] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [sidebarWidth, setSidebarWidth] = React.useState(20);
  const [newFileModal, setNewFileModal] = React.useState(false);
  const [newFilePath, setNewFilePath] = React.useState("");

  const type: ScriptType = "workspace";

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

  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
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

  const tree = React.useMemo(() => buildTree(scripts), [scripts]);

  const collectFolderPaths = (nodes: TreeNode[]): string[] => {
    const paths: string[] = [];
    for (const n of nodes) {
      if (n.type === "folder") {
        paths.push(n.relPath);
        if (n.children) paths.push(...collectFolderPaths(n.children));
      }
    }
    return paths;
  };

  React.useEffect(() => {
    if (tree.length > 0 && expanded.size === 0) {
      const root = tree[0];
      setExpanded(new Set(["", ...(root.type === "folder" && root.children ? collectFolderPaths(root.children) : [])]));
    }
  }, [tree]);

  const expandAll = () => {
    const paths = new Set<string>();
    const visit = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.type === "folder") paths.add(n.relPath);
        if (n.children) visit(n.children);
      }
    };
    visit(tree);
    setExpanded(paths);
  };

  const handleToggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleSelect = (script: Script) => {
    setSelected(script);
    setEditContent(script.content);
    setEditName(script.name);
    setSaveError(null);
  };

  const handleSave = React.useCallback(async () => {
    if (!selected) return;
    setSaveError(null);
    setSaveLoading(true);
    try {
      await api.saveScript(type, { name: editName, content: editContent });
      load();
      setSelected((prev) => prev && { ...prev, name: editName, content: editContent });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaveLoading(false);
    }
  }, [selected, editName, editContent, load]);

  const handleDelete = React.useCallback(async () => {
    if (!selected) return;
    if (!window.confirm(`Удалить "${selected.name}"?`)) return;
    try {
      await api.deleteScript(type, selected.id);
      setSelected(null);
      load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    }
  }, [selected, load]);

  const handleCreateNew = React.useCallback(async () => {
    const path = newFilePath.trim().replace(/\\/g, "/") || "newfile.lua";
    setNewFileModal(false);
    setNewFilePath("");
    try {
      const saved = await api.saveScript(type, { name: path, content: "" });
      load();
      handleSelect(saved);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка создания");
    }
  }, [newFilePath, load]);

  return (
    <section className="workspace-page">
      <h1 className="page-title">Workspace</h1>
      <div className="workspace-layout">
        <aside
          className="card workspace-sidebar"
          style={{ width: `${sidebarWidth}%`, minWidth: 200, maxWidth: 360 }}
        >
          <div
            className="workspace-sidebar-resizer"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startW = sidebarWidth;
              const onMove = (ev: MouseEvent) => {
                const delta = ((ev.clientX - startX) / window.innerWidth) * 100;
                setSidebarWidth(Math.min(50, Math.max(15, startW + delta)));
              };
              const onUp = () => {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
              };
              document.addEventListener("mousemove", onMove);
              document.addEventListener("mouseup", onUp);
            }}
          />
          <div className="workspace-sidebar-header">
            <span className="workspace-sidebar-title">Workspace</span>
            <div className="workspace-sidebar-actions">
              <button
                type="button"
                className="btn-ghost btn-sm"
                title="Развернуть всё"
                onClick={expandAll}
              >
                ⊕
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={handleSync}
                disabled={syncLoading}
              >
                {syncLoading ? "…" : "↻"}
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                title="Новый файл"
                onClick={() => setNewFileModal(true)}
              >
                +
              </button>
            </div>
          </div>
          <div className="workspace-tree">
            {loading ? (
              <div className="workspace-tree-empty">Загрузка…</div>
            ) : error ? (
              <div className="workspace-tree-empty error">{error}</div>
            ) : tree.length === 0 ? (
              <div className="workspace-tree-empty">Нет файлов</div>
            ) : (
              tree.map((node) => (
                <WorkspaceTreeItem
                  key={node.relPath}
                  node={node}
                  expanded={expanded}
                  onToggle={handleToggle}
                  onSelect={handleSelect}
                  selectedPath={selected?.name ?? null}
                />
              ))
            )}
          </div>
        </aside>

        <main className="card workspace-editor-panel">
          <div className="workspace-editor-header">
            <span className="workspace-editor-filename">
              {selected ? selected.name : "Выберите файл"}
            </span>
            {selected && (
              <div className="workspace-editor-actions">
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={handleSave}
                  disabled={saveLoading}
                >
                  {saveLoading ? "Сохранение…" : "Сохранить"}
                </button>
                <button
                  type="button"
                  className="btn-danger btn-sm"
                  onClick={handleDelete}
                >
                  Удалить
                </button>
              </div>
            )}
          </div>
          <div className="workspace-editor-divider" role="separator" />
          {saveError && <p className="error workspace-editor-error">{saveError}</p>}
          <div className="workspace-editor-content">
            {selected ? (
              <ScriptEditor
                value={editContent}
                onChange={setEditContent}
                height="100%"
              />
            ) : (
              <div className="workspace-editor-placeholder">
                Откройте файл в дереве слева или создайте новый
              </div>
            )}
          </div>
        </main>
      </div>

      <Modal
        open={newFileModal}
        onClose={() => setNewFileModal(false)}
        title="Новый файл"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateNew();
          }}
          className="form"
        >
          <div className="form-row">
            <label className="form-label" htmlFor="workspace-new-path">
              Путь (например: DampGame/ABC.lua)
            </label>
            <input
              id="workspace-new-path"
              type="text"
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              placeholder="folder/file.lua"
              className="form-input"
              onKeyDown={(e) => e.key === "Escape" && setNewFileModal(false)}
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => setNewFileModal(false)}>
              Отмена
            </button>
            <button type="submit">Создать</button>
          </div>
        </form>
      </Modal>
    </section>
  );
};
