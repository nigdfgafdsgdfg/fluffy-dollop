import { getMe, setAuthTokenGetter } from "@workspace/api-client-react";
import {
  GoogleAuthProvider,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

import { auth } from "@/lib/firebase";
import type { UserProfile } from "@workspace/api-client-react";

interface AuthContextValue {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  isLoading: boolean;
  needsProfile: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);

  const fetchProfile = useCallback(async (isRetry = false): Promise<UserProfile | null> => {
    try {
      const userProfile = await getMe();
      setProfileState(userProfile);
      setNeedsProfile(false);
      return userProfile;
    } catch (err: unknown) {
      const apiErr = err as { status?: number };

      if (apiErr?.status === 404) {
        setProfileState(null);
        setNeedsProfile(true);
        return null;
      }

      if (apiErr?.status === 401 && !isRetry) {
        try {
          if (auth.currentUser) {
            await auth.currentUser.getIdToken(true);
          }
          return fetchProfile(true);
        } catch {
          setProfileState(null);
          setNeedsProfile(false);
          return null;
        }
      }

      setProfileState(null);
      setNeedsProfile(false);
      return null;
    }
  }, []);

  useEffect(() => {
    setAuthTokenGetter(async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return null;
      try {
        return await currentUser.getIdToken(false);
      } catch {
        return await currentUser.getIdToken(true);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile();
      } else {
        setProfileState(null);
        setNeedsProfile(false);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (Platform.OS !== "web") {
      throw new Error("Google sign-in is only supported on web.");
    }
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setProfileState(null);
    setNeedsProfile(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
    setNeedsProfile(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        needsProfile,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshProfile,
        setProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
