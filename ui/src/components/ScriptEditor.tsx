import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { langs } from "@uiw/codemirror-extensions-langs";
import { vscodeDark } from "@uiw/codemirror-themes-all";

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  readOnly?: boolean;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  value,
  onChange,
  height = "300px",
  readOnly = false
}) => {
  const extensions = React.useMemo(() => [langs.lua()], []);

  return (
    <div className="script-editor">
      <CodeMirror
        value={value}
        height={height}
        extensions={extensions}
        onChange={onChange}
        readOnly={readOnly}
        theme={vscodeDark}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: true
        }}
      />
    </div>
  );
};
