import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "@/lib/i18n";
import { AlertTriangle } from "lucide-react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode; inline?: boolean }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={this.props.inline ? "py-16" : "flex min-h-dvh items-center justify-center p-6"}>
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">{i18n.t("errors.generic")}</h2>
          <p className="text-sm text-muted-foreground">{i18n.t("errors.genericBody")}</p>
          <button className="mt-2 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary" onClick={() => window.location.reload()}>
            {i18n.t("errors.reload")}
          </button>
        </div>
      </div>
    );
  }
}
