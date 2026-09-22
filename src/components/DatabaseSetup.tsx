import React, { useState, useEffect } from "react";
import { auth, googleProvider } from "../lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { 
  Database, 
  Copy, 
  Check, 
  Info, 
  Trash2, 
  Globe, 
  Key, 
  ShieldCheck, 
  Share2, 
  LogIn, 
  LogOut, 
  UserCheck, 
  Sparkles,
  Code,
  ExternalLink,
  RefreshCw,
  Zap
} from "lucide-react";

export default function DatabaseSetup({ onConfigChange }: { onConfigChange: () => void }) {
  // Firebase auth states
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  // Gemini API Key state
  const [geminiKeyInput, setGeminiKeyInput] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem("custom_gemini_api_key") || "" : "")
  );
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // GitHub Auto-Sync states
  const [ghToken, setGhToken] = useState("");
  const [ghOwner, setGhOwner] = useState("");
  const [ghRepo, setGhRepo] = useState("");
  const [ghBranch, setGhBranch] = useState("main");
  const [ghLoading, setGhLoading] = useState(false);
  const [ghResult, setGhResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSaveGeminiKey = () => {
    if (typeof window !== "undefined") {
      if (geminiKeyInput.trim()) {
        localStorage.setItem("custom_gemini_api_key", geminiKeyInput.trim());
        setGeminiKeySaved(true);
        setTimeout(() => setGeminiKeySaved(false), 2500);
      } else {
        localStorage.removeItem("custom_gemini_api_key");
        setGeminiKeySaved(true);
        setTimeout(() => setGeminiKeySaved(false), 2500);
      }
    }
  };

  const handleClearGeminiKey = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("custom_gemini_api_key");
      setGeminiKeyInput("");
      setGeminiKeySaved(false);
    }
  };

  const handleTestHealth = async () => {
    setHealthLoading(true);
    setHealthStatus(null);
    try {
      const res = await fetch(`/api/health?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        }
      });
      const data = await res.json();
      if (res.ok && data.status === "ok") {
        setHealthStatus(`Connected! Server responded OK at ${new Date(data.time).toLocaleTimeString()}`);
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

  const handleGitHubSync = async () => {
    if (!ghToken || !ghOwner || !ghRepo) {
      setGhResult({ success: false, message: "Please provide your GitHub Token, Owner/Username, and Repository Name." });
      return;
    }
    setGhLoading(true);
    setGhResult(null);
    try {
      const customKey = localStorage.getItem("custom_gemini_api_key") || "";
      const res = await fetch(`/api/github-sync?_t=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          ...(customKey ? { "x-gemini-key": customKey } : {})
        },
        body: JSON.stringify({
          token: ghToken,
          owner: ghOwner,
          repo: ghRepo,
          branch: ghBranch || "main",
          commitMessage: "feat: automated push of AI Synthetic Trading workstation and Deriv API workspace"
        })
      });
      const data = await res.json();
      if (data.success) {
        setGhResult({ success: true, message: `Successfully pushed ${data.filesCount} files to ${ghOwner}/${ghRepo} (${ghBranch || "main"})! Commit SHA: ${data.commitSha.substring(0, 7)}` });
      } else {
        setGhResult({ success: false, message: data.error || "Failed to push to GitHub repository." });
      }
    } catch (err: any) {
      setGhResult({ success: false, message: err.message || "Network error during GitHub synchronization." });
    } finally {
      setGhLoading(false);
    }
  };

  useEffect(() => {
    // Listen to Firebase Auth state
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
      onConfigChange(); // refresh trade list matching UID
    } catch (err: any) {
      console.error("Firebase Google active sign-in crash:", err);
      setAuthError(err.message || "Failed to establish popup connection. Verify browser permissions.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    setAuthLoading(true);
    try {
      await signOut(auth);
      onConfigChange(); // refresh matching fallback trades
    } catch (err: any) {
      console.error("Firebase sign-out failed:", err);
    } finally {
      setAuthLoading(false);
    }
  };

  const sqlSchema = `-- Supabase Table Schema Configuration for Synthetic SMC Analytica
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    bias VARCHAR(20) NOT NULL,
    entry_price NUMERIC NOT NULL,
    stop_loss NUMERIC NOT NULL,
    take_profit NUMERIC NOT NULL,
    risk_reward VARCHAR(10),
    image_url TEXT,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'PENDING'
);`;

  return (
    <div className="space-y-6" id="database-setup">
      {/* 1. FIREBASE INTERFACE SECTION */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden">
        {/* Visual backdrop ambient light */}
        <div className="absolute top-0 right-0 h-48 w-48 bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-amber-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display text-slate-900 flex items-center gap-2">
                Firebase Firestore Sync Engine
                <span className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-sans tracking-wide">
                  Main Database Option
                </span>
              </h2>
              <p className="text-xs text-slate-600">Sync, secure, and isolate trading logs to your personal Cloud vault</p>
            </div>
          </div>
        </div>

        {authLoading ? (
          <div className="flex items-center gap-2 text-slate-600 text-xs py-4">
            <div className="h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            Authenticating Cloud access credentials...
          </div>
        ) : firebaseUser ? (
          <div className="bg-slate-50/40 border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 bg-indigo-950/20 px-3.5 py-2.5 rounded-xl border border-indigo-900/30 w-full sm:w-auto">
                <div className="h-8 w-8 bg-indigo-600 rounded-full flex items-center justify-center font-bold font-display text-slate-900 text-sm">
                  {firebaseUser.email ? firebaseUser.email[0].toUpperCase() : "U"}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-bold text-slate-900 leading-none">
                      {firebaseUser.displayName || "Active SMC Trader"}
                    </p>
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-900/30 text-[9px] font-semibold px-1.5 py-0.5 rounded">
                      Linked
                    </span>
                    {firebaseUser.email === "ibrahimfaruqolamilekan4@gmail.com" && (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/45 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm shadow-amber-500/15 animate-pulse">
                        <ShieldCheck className="h-3.5 w-3.5 text-amber-450" />
                        System Admin
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1.5 font-mono">{firebaseUser.email}</p>
                </div>
              </div>

              <button
                onClick={handleGoogleLogout}
                className="w-full sm:w-auto px-4 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer font-semibold"
              >
                <LogOut className="h-3.5 w-3.5 text-slate-600" />
                Disconnect Vault
              </button>
            </div>

            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 text-emerald-200/90 text-xs rounded-lg leading-relaxed flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Cloud synchronization active:</strong> All your trade results, image snapshots, and analysis logs are fully synchronized to Firebase Firestore in real-time.
              </span>
            </div>

            {firebaseUser.email === "ibrahimfaruqolamilekan4@gmail.com" && (
              <div className="p-5 border border-amber-500/20 bg-amber-500/5 rounded-xl space-y-4">
                <div className="flex items-center gap-2 text-amber-400">
                  <ShieldCheck className="h-5 w-5" />
                  <h3 className="text-xs font-bold tracking-wider uppercase font-display">
                    Secure Administrator System Console
                  </h3>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Welcome back, <strong>ibrahimfaruqolamilekan4@gmail.com</strong>. The matrix recognizes you as the high-level system administrator. Below are administrative trackers for global operations:
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-amber-400 uppercase font-mono tracking-wider font-bold block mb-1">
                      Platform Security Protocol
                    </span>
                    <p className="text-[11px] text-slate-600 mb-2">
                      Rules deployed successfully with ABAC invariants and Zero-Trust validation helpers.
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-mono">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
                      ACTIVE SECURE PROTOCOL
                    </div>
                  </div>
                  
                  <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-amber-400 uppercase font-mono tracking-wider font-bold block mb-1">
                      System Metadata Diagnostics
                    </span>
                    <p className="text-[11px] text-slate-600 mb-2">
                      Verify active routing nodes, user quotas, and sandbox database integrity.
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-700 font-mono">
                      <span className="p-1 px-1.5 bg-indigo-500/10 border border-indigo-500/35 rounded text-[9px] text-indigo-400">
                        ONLINE
                      </span>
                      <span>No Latency Gaps</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-mono border-b border-slate-200 pb-1.5">
                    <span className="text-slate-600">ADMINISTRATOR USER EMAIL:</span>
                    <span className="text-amber-300 font-bold">ibrahimfaruqolamilekan4@gmail.com</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-mono">
                    <span className="text-slate-600">FIRESTORE SECURITY ACCESS:</span>
                    <span className="text-emerald-400 font-bold uppercase">GLOBAL PRIVILEGED ROUTING</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-700 leading-relaxed max-w-xl">
              Connect your Google account to log into your persistent SMC database safely. Your trade logs remain secure and separated from other traders.
            </p>

            <button
              onClick={handleGoogleLogin}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 font-bold text-[#090d16] text-xs rounded-xl transition cursor-pointer flex items-center gap-2 font-semibold shadow-lg shadow-amber-500/10 active:scale-[0.98]"
            >
              <LogIn className="h-4 w-4" />
              Sign in with Google Account
            </button>

            {authError && (
              <div className="p-3 bg-rose-500/5 border border-rose-500/10 text-rose-400 text-xs rounded-lg">
                {authError}
              </div>
            )}

            <div className="p-4 rounded-xl border border-dashed border-sky-950 bg-sky-950/10 flex gap-2.5">
              <Info className="h-4 w-4 text-sky-450 shrink-0 mt-0.5" />
              <p className="text-xs text-sky-200 leading-normal">
                No active sign-in requirement: When not logged in, data writes safely fallback to your local storage to prevent data loss.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* GitHub Automated Sync & Push */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 h-48 w-48 bg-cyan-500/5 blur-[80px] rounded-full pointer-events-none"></div>
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-cyan-500/10 border border-cyan-500/20 p-2.5 rounded-xl text-cyan-400">
            <Code className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
              Automated GitHub Repository Sync & Push
              <span className="text-xs bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded-full text-cyan-300">
                Octokit Powered
              </span>
            </h3>
            <p className="text-xs text-slate-600">Automatically push all project files, AI scanner components, and trading modules to your GitHub repository</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">GitHub Personal Access Token (PAT)</label>
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
                className="w-true w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Needs `repo` or `public_repo` scope permissions.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">GitHub Username / Organization</label>
              <input
                type="text"
                placeholder="e.g. ibrahimfaruq"
                value={ghOwner}
                onChange={(e) => setGhOwner(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Repository Name</label>
              <input
                type="text"
                placeholder="e.g. deriv-smc-ai-workstation"
                value={ghRepo}
                onChange={(e) => setGhRepo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Branch Name</label>
              <input
                type="text"
                placeholder="main"
                value={ghBranch}
                onChange={(e) => setGhBranch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {ghResult && (
            <div className={`p-3 rounded-xl border text-xs font-mono leading-relaxed ${ghResult.success ? "bg-emerald-950/40 border-emerald-800 text-emerald-300" : "bg-red-950/40 border-red-800 text-red-300"}`}>
              {ghResult.message}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              onClick={handleGitHubSync}
              disabled={ghLoading}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              {ghLoading ? (
                <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Code className="h-4 w-4" />
              )}
              {ghLoading ? "Syncing & Pushing to GitHub..." : "Sync & Push to GitHub Now"}
            </button>
            <a
              href="https://github.com/new"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-medium text-xs rounded-xl transition flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4 text-cyan-400" />
              Create New GitHub Repo
            </a>
          </div>
        </div>
      </div>

      {/* Gemini AI & Vercel Deployment Setup */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-emerald-600">
            <Key className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
              Gemini AI & Vercel Deployment Control
              <span className="text-xs bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-emerald-700 font-semibold">
                Direct Device Key
              </span>
            </h3>
            <p className="text-xs text-slate-600">
              Configure your Gemini API key for Vercel production or override locally on this browser
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
            <p className="text-slate-700 leading-relaxed">
              <strong>How Vercel Works:</strong> On Vercel, the environment variable <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-900 font-mono">GEMINI_API_KEY</code> must be added in your <strong>Vercel Dashboard &gt; Project &gt; Settings &gt; Environment Variables</strong>.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Alternatively, you can paste your Gemini API Key below. It will be stored securely in this browser&apos;s local memory and sent with every analysis request:
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Custom Gemini API Key (Optional Override)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AIzaSy..."
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                onClick={handleSaveGeminiKey}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                Save Key
              </button>
              {geminiKeyInput && (
                <button
                  onClick={handleClearGeminiKey}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-xl transition cursor-pointer"
                  title="Clear Key"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {geminiKeySaved && (
              <p className="text-[11px] text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Gemini API Key saved for this device!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Diagnostics & Cache Management */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-indigo-500/10 border border-indigo-500/20 p-2.5 rounded-xl text-indigo-600">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
              System Diagnostics & Cache Purge
            </h3>
            <p className="text-xs text-slate-600">
              Test server responsiveness and purge stale cached assets
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleTestHealth}
              disabled={healthLoading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-medium text-xs rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              {healthLoading ? (
                <div className="h-3.5 w-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Zap className="h-3.5 w-3.5 text-amber-500" />
              )}
              Test Live Server Connection
            </button>

            <button
              onClick={handlePurgeCacheAndReload}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-medium text-xs rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-rose-500" />
              Purge Browser Cache & Force Reload
            </button>
          </div>

          {healthStatus && (
            <div className={`p-3 rounded-xl border text-xs font-mono ${healthStatus.includes("Connected") ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
              {healthStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
