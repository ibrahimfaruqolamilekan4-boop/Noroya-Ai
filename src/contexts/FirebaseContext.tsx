import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider, testConnection } from "../lib/firebase";
import { getLocalTradesCount, migrateLocalTradesToFirestore } from "../lib/db";

interface FirebaseContextValue {
  user: User | null;
  isAuthReady: boolean;
  isCloudConnected: boolean;
  authLoading: boolean;
  authError: string | null;
  localTradesCount: number;
  migrating: boolean;
  migrationMessage: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutGoogle: () => Promise<void>;
  syncLocalToCloud: () => Promise<number>;
  refreshLocalCount: () => void;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [localTradesCount, setLocalTradesCount] = useState<number>(() => getLocalTradesCount());
  const [migrating, setMigrating] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);

  const refreshLocalCount = useCallback(() => {
    setLocalTradesCount(getLocalTradesCount());
  }, []);

  useEffect(() => {
    testConnection().then((ok) => setIsCloudConnected(ok));
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      setLocalTradesCount(getLocalTradesCount());
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    setMigrationMessage(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setLocalTradesCount(getLocalTradesCount());
    } catch (err: any) {
      console.error("Google Sign-In error:", err);
      setAuthError(
        err?.message || "Popup sign-in was blocked or cancelled. Please allow popups and try again."
      );
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signOutGoogle = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    setMigrationMessage(null);
    try {
      await signOut(auth);
      setLocalTradesCount(getLocalTradesCount());
    } catch (err: any) {
      console.error("Google Sign-Out error:", err);
      setAuthError(err?.message || "Failed to disconnect cloud session.");
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const syncLocalToCloud = useCallback(async () => {
    if (!auth.currentUser) return 0;
    setMigrating(true);
    setMigrationMessage(null);
    try {
      const migrated = await migrateLocalTradesToFirestore();
      setLocalTradesCount(getLocalTradesCount());
      setMigrationMessage(
        migrated > 0
          ? `Synced ${migrated} local trade${migrated === 1 ? "" : "s"} to Firebase Firestore.`
          : "All local trades are already synced."
      );
      return migrated;
    } catch (err: any) {
      setMigrationMessage(
        `Sync encountered an error: ${err?.message || "Please verify your connection."}`
      );
      return 0;
    } finally {
      setMigrating(false);
    }
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        user,
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
        refreshLocalCount,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error("useFirebase must be used inside a FirebaseProvider");
  }
  return ctx;
}
