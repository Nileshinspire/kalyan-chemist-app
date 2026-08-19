import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[PageErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertTriangle className="size-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Something went wrong
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
            This page encountered an unexpected error. You can try reloading it
            or head back to the homepage.
          </p>
          {this.state.error && (
            <p className="mt-3 max-w-md rounded-lg border border-border/60 bg-muted/50 p-3 text-left text-xs text-muted-foreground font-mono break-all">
              {this.state.error.message}
            </p>
          )}
          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              <RefreshCcw className="size-3.5" />
              Reload Page
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = "/";
              }}
            >
              <Home className="size-3.5" />
              Go Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
