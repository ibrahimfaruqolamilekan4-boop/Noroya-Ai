import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { firebaseProjectId, firebaseDatabaseId } from "../lib/firebase";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isQuotaError: boolean;
  isPermissionError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: Readonly<ErrorBoundaryProps>;
  declare setState: (state: Partial<ErrorBoundaryState>) => void;

  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
    isQuotaError: false,
    isPermissionError: false,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error?.message || "An unexpected application error occurred.";
    let friendly = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.error && parsed.operationType) {
        friendly = `Firestore ${parsed.operationType} error on "${parsed.path || "unknown"}": ${parsed.error}`;
      }
    } catch {
      // Plain error message
    }

    const lower = friendly.toLowerCase();
    return {
      hasError: true,
      errorMessage: friendly,
      isQuotaError: lower.includes("quota exceeded"),
      isPermissionError: lower.includes("missing or insufficient permissions"),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application ErrorBoundary caught:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      errorMessage: "",
      isQuotaError: false,
      isPermissionError: false,
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const upgradeUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/firestore/databases/${firebaseDatabaseId}/data?openUpgradeDialog=true`;

    return (
      <div className="min-h-screen bg-[#E4E8EE] text-slate-900 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-[#F1F4F8] border border-slate-300 rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display text-slate-900">
                {this.state.isQuotaError
                  ? "Firestore Daily Quota Reached"
                  : this.state.isPermissionError
                  ? "Cloud Sync Permission Notice"
                  : "Something Went Wrong"}
              </h2>
              <p className="text-xs text-slate-600">
                Your local trading workspace is still safe.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300 text-xs font-mono text-slate-700 break-words">
            {this.state.errorMessage}
          </div>

          {this.state.isQuotaError && (
            <p className="text-xs text-slate-600 leading-relaxed">
              The free daily Firestore quota resets tomorrow. You can inspect or upgrade your database quota in the{" "}
              <a
                href={upgradeUrl}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 underline font-semibold"
              >
                Firebase Console
              </a>
              .
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Return to Terminal</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Reload App
            </button>
          </div>
        </div>
      </div>
    );
  }
}
