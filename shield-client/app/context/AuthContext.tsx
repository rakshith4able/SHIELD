"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import { User } from "firebase/auth";
import axios from "axios";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userRole: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  userRole: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const token = await user.getIdToken();
        try {
          const response = await axios.post(
            "http://localhost:5000/verify-user",
            { token },
            { headers: { "Content-Type": "application/json" } }
          );

          const data = response.data; // Access the response data

          if (data?.authorized) {
            setUserRole(data?.role);
            setUser(user);
          } else {
            await auth.signOut();
            setUser(null);
            setUserRole(null);
          }
        } catch (error) {
          console.error("Error verifying user:", error);
          await auth.signOut();
          setUser(null);
          setUserRole(null);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, userRole }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
