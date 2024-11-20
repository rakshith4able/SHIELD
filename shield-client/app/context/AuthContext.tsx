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
  userDetails: UserDetails | null;
  loading: boolean;
  userRole: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

interface UserDetails {
  id: string;
  name: string;
  email: string;
  photoURL: string;
  isFaceTrained: boolean;
  isValidated: boolean;
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userDetails: null,
  loading: true,
  userRole: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  error: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
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

        const userDetailsResponse = await axios.get<UserDetails>(
          "http://localhost:5000/user/me",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setUserDetails(userDetailsResponse.data);

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
      setUserDetails(null);
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

          // Step 1: Verify the user using the token
          const response = await axios.post<VerifyUserResponse>(
            "http://localhost:5000/verify-user",
            { token },
            {
              headers: { "Content-Type": "application/json" },
            }
          );

          const data = response.data;

          // Step 2: If the user is authorized, fetch user details
          if (data.authorized && data.role) {
            setUser(user); // Set user in state
            setUserRole(data.role); // Set role in state

            const userDetailsResponse = await axios.get<UserDetails>(
              "http://localhost:5000/user/me",
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            // Step 3: Set the fetched user details in state
            setUserDetails(userDetailsResponse.data);

            // Optional: Handle role-based redirects after the user is verified
            handleRoleBasedRedirect(data.role);
          } else {
            // If not authorized, sign out and reset states
            await firebaseSignOut(auth);
            setUser(null);
            setUserRole(null);
            setUserDetails(null);
            setError("Not authorized to access this application");
          }
        } catch (error) {
          console.error("Error verifying user:", error);
          await firebaseSignOut(auth);
          setUser(null);
          setUserRole(null);
          setUserDetails(null); // Clear user details in case of error
          setError("Error verifying user credentials");
        }
      } else {
        setUser(null);
        setUserDetails(null); // Clear user details if no user is signed in
        setUserRole(null);
      }

      setLoading(false); // Set loading to false after auth check is complete
    });

    return () => unsubscribe();
  }, [router]); // Dependency on router to ensure effect runs on mount

  return (
    <AuthContext.Provider
      value={{
        user,
        userDetails,
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
