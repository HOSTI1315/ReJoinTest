import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            fontFamily: "system-ui, sans-serif",
            background: "#0c0c0f",
            color: "#fafafa"
          }}
        >
          <h1 style={{ marginBottom: 16, fontSize: 20 }}>Ошибка загрузки</h1>
          <pre
            style={{
              padding: 16,
              background: "#141418",
              borderRadius: 8,
              overflow: "auto",
              maxWidth: 600,
              fontSize: 12
            }}
          >
            {this.state.error.message}
          </pre>
          <p style={{ marginTop: 16, color: "#a1a1aa", fontSize: 13 }}>
            Убедитесь, что API запущен: <code>python api_server.py</code>
          </p>
          <p style={{ color: "#a1a1aa", fontSize: 13 }}>
            Откройте консоль (F12) для подробностей
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
