import React, { useState, useEffect } from "react";
import { useFirebase } from "../contexts/FirebaseContext";
import { firebaseDatabaseId, firebaseProjectId } from "../lib/firebase";
import {
  Database,
  Info,
  ShieldCheck,
  LogIn,
  LogOut,
  UserCheck,
  RefreshCw,
  Zap,
  CloudUpload,
  CheckCircle2,
} from "lucide-react";

export default function DatabaseSetup({ onConfigChange }: { onConfigChange: () => void }) {
  const {
    user: firebaseUser,
    isAuthReady,
    isCloudConnected,
    authLoading,
    authError,
    localTradesCount,
    migrating,
    migrationMessage,
    signInWithGoogle,
    signOutGoogle,
    syncLocalToCloud,
  } = useFirebase();

  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Clean up any legacy local storage key on mount
  useEffect(() => {
    try {
      localStorage.removeItem("custom_gemini_api_key");
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleTestHealth = async () => {
    setHealthLoading(true);
    setHealthStatus(null);
    try {
      const res = await fetch(`/api/health?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      const data = await res.json();
      if (res.ok && data.status === "ok") {
        setHealthStatus(
          `Connected! Server responded OK at ${new Date(data.time).toLocaleTimeString()}`
        );
      } else {
        setHealthStatus(`Server responded with unexpected status: ${res.status}`);
      }
    } catch (e: any) {
      setHealthStatus(`Connection failed: ${e.message || "Network Error"}`);
    } finally {
      setHealthLoading(false);
    }
  };

  const handlePurgeCacheAndReload = async () => {
    if (typeof window !== "undefined") {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            await reg.unregister();
          }
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          for (const k of keys) {
            await caches.delete(k);
          }
        }
      } catch (e) {
        console.warn("Cache purge error:", e);
      }
      window.location.reload();
    }
  };

  const handleGoogleLogin = async () => {
    await signInWithGoogle();
    onConfigChange();
  };

  const handleGoogleLogout = async () => {
    await signOutGoogle();
    onConfigChange();
  };

  const handleSyncLocal = async () => {
    await syncLocalToCloud();
    onConfigChange();
  };

  return (
    <div className="space-y-6" id="database-setup">
      {/* 1. FIREBASE CLOUD VAULT SECTION */}
      <div className="bg-[#F1F4F8] border border-slate-300/80 rounded-xl p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-300 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-emerald-700">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-mono text-emerald-700">
                Cloud Persistence &amp; Multi-Device Ledger
              </div>
              <h2 className="text-lg font-bold font-display text-slate-900">
                Firebase Firestore Sync Engine
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-600 bg-[#E8ECF2] px-3 py-1.5 rounded-lg border border-slate-300">
            <span
              className={`h-2 w-2 rounded-full ${
                isCloudConnected ? "bg-emerald-600" : "bg-rose-500"
              }`}
            />
            <span>{isCloudConnected ? "Firestore Online" : "Firestore Offline"}</span>
          </div>
        </div>

        {!isAuthReady || authLoading ? (
          <div className="flex items-center gap-2 text-slate-600 text-xs py-4">
            <div className="h-4 w-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            Connecting to Firebase Authentication &amp; Firestore...
          </div>
        ) : firebaseUser ? (
          <div className="bg-[#E8ECF2] border border-slate-300 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 bg-[#F1F4F8] px-4 py-3 rounded-lg border border-slate-300 w-full sm:w-auto">
                <div className="h-9 w-9 bg-emerald-600 rounded-full flex items-center justify-center font-bold font-display text-white text-sm">
                  {firebaseUser.email ? firebaseUser.email[0].toUpperCase() : "U"}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-bold text-slate-900">
                      {firebaseUser.displayName || "Active Trader"}
                    </span>
                    <span>·</span>
                    <span className="text-emerald-700 font-semibold">Cloud Linked</span>
                    {firebaseUser.email === "ibrahimfaruqolamilekan4@gmail.com" && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-800 font-semibold">Admin</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 font-mono">{firebaseUser.email}</p>
                </div>
              </div>

              <button
                onClick={handleGoogleLogout}
                className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer font-semibold"
              >
                <LogOut className="h-3.5 w-3.5 text-slate-600" />
                Disconnect Cloud
              </button>
            </div>

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-lg leading-relaxed flex items-center gap-2.5">
              <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Real-time Firestore sync active:</strong> Your Trade Journal, AI Scalp/Normal Scan History, Coach Chat, Personal Trading Rules, and Setup Preferences are synced securely to Firebase Firestore.
              </span>
            </div>

            {/* Active Synced Collections Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              {[
                { name: "trades", desc: "Real-time trade journal & P&L ledger" },
                { name: "analysis_reports", desc: "Saved Scalp & Normal AI chart scans" },
                { name: "user_preferences", desc: "Synced Scalp/Normal style & default symbol" },
                { name: "user_learnings", desc: "Personal rules fed into the AI analyzer" },
                { name: "chat_history", desc: "AI Trading Coach conversation history" },
              ].map((col) => (
                <div
                  key={col.name}
                  className="bg-[#F1F4F8] border border-slate-300 rounded-lg p-3 flex items-start gap-2"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-mono font-bold text-slate-900">/{col.name}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{col.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Local-to-Cloud Migration Card */}
            {localTradesCount > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-amber-900">
                  <strong>
                    {localTradesCount} local trade{localTradesCount === 1 ? "" : "s"} found in this browser.
                  </strong>{" "}
                  Upload them to Firestore so they appear across all your devices.
                </div>
                <button
                  type="button"
                  onClick={handleSyncLocal}
                  disabled={migrating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <CloudUpload className="h-3.5 w-3.5" />
                  <span>{migrating ? "Uploading..." : "Sync Local Trades to Cloud"}</span>
                </button>
              </div>
            )}

            {migrationMessage && (
              <div className="p-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 font-medium">
                {migrationMessage}
              </div>
            )}

            {firebaseUser.email === "ibrahimfaruqolamilekan4@gmail.com" && (
              <div className="p-4 border border-emerald-200 bg-white rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                  <h3 className="text-xs font-bold tracking-wider uppercase font-display">
                    Administrator Firestore Config
                  </h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-mono">
                  Project: {firebaseProjectId} · Database: {firebaseDatabaseId}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
              Connect your Google account to sync your Trade Journal, AI Scalp/Normal Scan History, Personal Trading Rules, and Preferences to Firebase Firestore across devices. Without signing in, everything still works locally in your browser.
            </p>

            <button
              onClick={handleGoogleLogin}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg transition cursor-pointer flex items-center gap-2 font-semibold shadow-xs"
            >
              <LogIn className="h-4 w-4" />
              Sign in with Google to Sync Firestore
            </button>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {authError}
              </div>
            )}

            <div className="p-4 rounded-lg border border-slate-300 bg-[#E8ECF2] flex gap-2.5">
              <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-700 leading-normal">
                Zero-Login Operation: You can use the full Scalp &amp; Normal trade analyzer, risk calculator, and local trade journal immediately without signing in.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. SYSTEM DIAGNOSTICS & CACHE MANAGEMENT */}
      <div className="bg-[#F1F4F8] border border-slate-300/80 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4 border-b border-slate-300 pb-4">
          <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-emerald-700">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-mono text-emerald-700">
              Runtime &amp; Service Worker Telemetry
            </div>
            <h3 className="text-base font-bold font-display text-slate-900">
              System Diagnostics &amp; Cache Management
            </h3>
          </div>
        </div>

        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          AI chart vision and live market analysis run automatically via your server environment variables. Use the controls below to verify server connectivity or refresh cached PWA assets.
        </p>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleTestHealth}
              disabled={healthLoading}
              className="px-4 py-2.5 bg-[#F8FAF9] hover:bg-emerald-50 border border-slate-300 hover:border-emerald-600 text-slate-900 font-semibold text-xs rounded-lg transition flex items-center gap-2 cursor-pointer"
            >
              {healthLoading ? (
                <div className="h-3.5 w-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Zap className="h-3.5 w-3.5 text-emerald-600" />
              )}
              Test Live Server Connection
            </button>

            <button
              onClick={handlePurgeCacheAndReload}
              className="px-4 py-2.5 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-slate-700 hover:text-rose-700 font-semibold text-xs rounded-lg transition flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-rose-600" />
              Purge Browser Cache &amp; Reload
            </button>
          </div>

          {healthStatus && (
            <div
              className={`p-3 rounded-lg border text-xs font-mono ${
                healthStatus.includes("Connected")
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {healthStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
