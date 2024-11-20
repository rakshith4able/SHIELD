"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import axios from "axios";
import { useRouter } from "next/navigation";

interface VerifyUserResponse {
  authorized: boolean;
  role?: "admin" | "user" | string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userRole: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  userRole: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  error: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleRoleBasedRedirect = (role: string) => {
    switch (role) {
      case "admin":
        router.push("/admin");
        break;
      default:
        router.push("/camera");
        break;
    }
  };

  // Google Sign In handler with role-based routing
  const signInWithGoogle = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();

      const response = await axios.post<VerifyUserResponse>(
        "http://localhost:5000/verify-user",
        { token },
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = response.data;
      if (data.authorized && data.role) {
        setUser(result.user);
        setUserRole(data.role);
        handleRoleBasedRedirect(data.role);
      } else {
        await firebaseSignOut(auth);
        setUser(null);
        setUserRole(null);
        setError("Not authorized to access this application");
      }
    } catch (error) {
      console.error("Error signing in with Google:", error);
      setError("Failed to sign in");
      await firebaseSignOut(auth);
      setUser(null);
      setUserRole(null);
    }
  };

  // Sign Out handler
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setUserRole(null);
      setError(null);
      router.push("/"); // Redirect to home page after sign out
    } catch (error) {
      console.error("Error signing out:", error);
      setError("Failed to sign out");
    }
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          const response = await axios.post<VerifyUserResponse>(
            "http://localhost:5000/verify-user",
            { token },
            {
              headers: { "Content-Type": "application/json" },
            }
          );

          const data = response.data;
          if (data.authorized && data.role) {
            setUser(user);
            setUserRole(data.role);
            // Don't redirect here to prevent unwanted redirects on page refresh
          } else {
            await firebaseSignOut(auth);
            setUser(null);
            setUserRole(null);
            setError("Not authorized to access this application");
          }
        } catch (error) {
          console.error("Error verifying user:", error);
          await firebaseSignOut(auth);
          setUser(null);
          setUserRole(null);
          setError("Error verifying user credentials");
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        userRole,
        signInWithGoogle,
        signOut,
        error,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
