"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  getIdToken,
} from "firebase/auth";
import axios, { AxiosError } from "axios";
import { useRouter } from "next/navigation";

interface VerifyUserResponse {
  authorized: boolean;
  role?: "admin" | "user" | string;
  message?: string;
  errorCode?: "FIRST_TIME_LOGIN" | "USER_NOT_FOUND" | "INVALID_TOKEN" | string;
}

interface AuthContextType {
  user: User | null;
  userDetails: UserDetails | null;
  loading: boolean;
  userRole: string | null;
  signInWithGoogle: () => Promise<AxiosError | undefined>;
  signOut: () => Promise<void>;
  error: {
    message: string;
    errorCode?: string;
  } | null;
}

interface UserDetails {
  id: string;
  name: string;
  email: string;
  role: string;
  photoURL: string;
  isFaceTrained: boolean;
  isValidated: boolean;
  canAccessSecureRoute: boolean;
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userDetails: null,
  loading: true,
  userRole: null,
  signInWithGoogle: async () => undefined,
  signOut: async () => {},
  error: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [error, setError] = useState<{
    message: string;
    errorCode?: string;
  } | null>(null);
  const router = useRouter();

  // Token refresh method
  const refreshToken = async (user: User): Promise<string | null> => {
    try {
      // Force token refresh
      const token = await getIdToken(user, true);
      return token;
    } catch (error) {
      console.error("Token refresh failed:", error);
      return null;
    }
  };

  // Centralized user verification method
  const verifyUser = async (user: User) => {
    try {
      // Get token with clock skew handling
      const token = await user.getIdToken(true);

      // Verify user with backend
      const response = await axios.post<VerifyUserResponse>(
        "http://localhost:5000/verify-user",
        { token },
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = response.data;

      // Handle different authorization scenarios
      if (data.authorized && data.role) {
        // Successful authorization
        setUser(user);
        setUserRole(data.role);

        // Fetch user details
        const userDetailsResponse = await axios.get<UserDetails>(
          "http://localhost:5000/user/me",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setUserDetails(userDetailsResponse.data);
        router.push("/");
        return undefined; // Indicate successful verification
      } else {
        // Handle unauthorized scenarios
        await firebaseSignOut(auth);
        setUser(null);
        setUserRole(null);

        // Set error with more detailed information
        setError({
          message: data.message || "Not authorized to access this application",
          errorCode: data.errorCode,
        });

        return undefined;
      }
    } catch (error) {
      // More comprehensive error handling
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<VerifyUserResponse>;

        // Check for token expiration or invalid token
        if (axiosError.response?.status === 401) {
          // Attempt to refresh token
          const refreshedToken = user ? await refreshToken(user) : null;

          if (refreshedToken) {
            // Retry verification with refreshed token
            try {
              const retryResponse = await axios.post<VerifyUserResponse>(
                "http://localhost:5000/verify-user",
                { token: refreshedToken },
                {
                  headers: { "Content-Type": "application/json" },
                }
              );

              if (retryResponse.data.authorized) {
                return undefined; // Successfully refreshed and verified
              }
            } catch (retryError) {
              console.error("Token refresh verification failed:", retryError);
            }
          }
        }

        // Sign out to ensure clean state
        await firebaseSignOut(auth);
        setUser(null);
        setUserRole(null);

        // Set detailed error
        setError({
          message:
            axiosError.response?.data?.message || "Authentication failed",
          errorCode: axiosError.response?.data?.errorCode,
        });

        return axiosError;
      }

      // Generic error handling
      console.error("Unexpected error during verification:", error);
      await firebaseSignOut(auth);
      setUser(null);
      setUserRole(null);
      setError({
        message: "An unexpected error occurred",
      });

      return undefined;
    }
  };

  // Google Sign In handler
  const signInWithGoogle = async () => {
    try {
      // Reset any previous errors
      setError(null);

      // Initiate Google Sign In
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      // Verify the newly signed-in user
      return await verifyUser(result.user);
    } catch (error) {
      console.error("Sign-in error:", error);
      setError({
        message: "Authentication failed. Please try again.",
      });
      return undefined;
    }
  };

  // Sign Out handler (mostly unchanged)
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
      setError({
        message: "Failed to sign out",
      });
    }
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // Use the centralized verification method
        await verifyUser(user);
      } else {
        setUser(null);
        setUserDetails(null);
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
