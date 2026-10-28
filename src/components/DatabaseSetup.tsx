import React, { useState, useEffect } from "react";
import { auth, googleProvider } from "../lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import {
  Database,
  Info,
  ShieldCheck,
  LogIn,
  LogOut,
  UserCheck,
  RefreshCw,
  Zap,
} from "lucide-react";

export default function DatabaseSetup({ onConfigChange }: { onConfigChange: () => void }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      await signInWithPopup(auth, googleProvider);
      onConfigChange();
    } catch (err: any) {
      console.error("Firebase Google active sign-in crash:", err);
      setAuthError(
        err.message || "Failed to establish popup connection. Verify browser permissions."
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    setAuthLoading(true);
    try {
      await signOut(auth);
      onConfigChange();
    } catch (err: any) {
      console.error("Firebase sign-out failed:", err);
    } finally {
      setAuthLoading(false);
    }
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
        </div>

        {authLoading ? (
          <div className="flex items-center gap-2 text-slate-600 text-xs py-4">
            <div className="h-4 w-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            Authenticating cloud access credentials...
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
                      {firebaseUser.displayName || "Active SMC Trader"}
                    </span>
                    <span>·</span>
                    <span className="text-emerald-700 font-semibold">Cloud Linked</span>
                    {firebaseUser.email === "ibrahimfaruqolamilekan4@gmail.com" && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-800 font-semibold">System Admin</span>
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
                Disconnect Vault
              </button>
            </div>

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-lg leading-relaxed flex items-center gap-2.5">
              <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Cloud synchronization active:</strong> All trade results, chart snapshots, and analysis logs are synchronized to Firebase Firestore in real time.
              </span>
            </div>

            {firebaseUser.email === "ibrahimfaruqolamilekan4@gmail.com" && (
              <div className="p-5 border border-emerald-200 bg-white rounded-xl space-y-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <ShieldCheck className="h-5 w-5" />
                  <h3 className="text-xs font-bold tracking-wider uppercase font-display">
                    Administrator System Console
                  </h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Authenticated as system administrator (<strong>ibrahimfaruqolamilekan4@gmail.com</strong>). Global Firestore security rules and server-side Vercel environment credentials are active.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
              Connect your Google account to synchronize your trade journal and custom SMC rules across devices. When not signed in, trade logs automatically persist in local browser storage.
            </p>

            <button
              onClick={handleGoogleLogin}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg transition cursor-pointer flex items-center gap-2 font-semibold shadow-xs"
            >
              <LogIn className="h-4 w-4" />
              Sign in with Google Account
            </button>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {authError}
              </div>
            )}

            <div className="p-4 rounded-lg border border-slate-300 bg-[#E8ECF2] flex gap-2.5">
              <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-700 leading-normal">
                Zero-Login Operation: You can use the full quantitative analyzer, risk calculator, and local trade journal without signing in.
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
          AI chart vision and quantitative analysis run automatically via your server-side Vercel environment variables. Use the controls below to verify server connectivity or refresh cached PWA assets.
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
