import React, { useState } from "react";
import { Download, Smartphone, X, Share, PlusSquare, WifiOff, CheckCircle2 } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isOnline, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      {/* Offline Resilience Indicator */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Offline Resilience Mode Active — Serving Cached Terminal &amp; Chart State</span>
        </div>
      )}

      {/* In-App Install Banner */}
      {!isInstalled && !dismissed && (
        <div className="bg-emerald-950 text-white border-b border-emerald-900 px-4 md:px-12 py-2 text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Smartphone className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-emerald-100 truncate">
              <span className="font-semibold text-white">Install QuantSMC Terminal App</span>
              <span className="hidden sm:inline text-emerald-200/80">
                {" "}· Standalone desktop &amp; mobile PWA with offline chart caching
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                if (isInstallable) {
                  await install();
                } else {
                  setShowModal(true);
                }
              }}
              className="px-3 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Install App</span>
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-1 text-emerald-300 hover:text-white rounded transition-colors cursor-pointer"
              aria-label="Dismiss install banner"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Guided Installation Modal for iOS Safari / Desktop Browsers */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 shadow-xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold font-display text-slate-900">
                  Install QuantSMC Native App
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-500 hover:text-slate-900 p-1 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <p>
                  To install QuantSMC on your iPhone or iPad with full-screen standalone performance:
                </p>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F8FAF9] border border-slate-200">
                  <Share className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900">1. Tap the Share Button</span>
                    <p className="text-slate-600 mt-0.5">Located in your Safari bottom or top navigation toolbar.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F8FAF9] border border-slate-200">
                  <PlusSquare className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900">2. Select &ldquo;Add to Home Screen&rdquo;</span>
                    <p className="text-slate-600 mt-0.5">Scroll down the share sheet and tap Add to Home Screen.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <p>
                  Install the standalone QuantSMC Terminal on Desktop (Chrome, Edge, Brave) or Android:
                </p>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F8FAF9] border border-slate-200">
                  <Download className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900">1. Click the Browser Install Icon</span>
                    <p className="text-slate-600 mt-0.5">
                      Click the install icon in the right side of your browser address bar (or open the browser menu &rarr; &ldquo;Install QuantSMC&rdquo;).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F8FAF9] border border-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900">2. Launch in Standalone Mode</span>
                    <p className="text-slate-600 mt-0.5">
                      Service Worker (<code className="font-mono text-emerald-700">sw.js</code>) is active and caching chart states for instant offline access.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="mt-5 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
