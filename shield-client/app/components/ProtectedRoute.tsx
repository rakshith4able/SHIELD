"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useEffect } from "react";

export function ProtectedRoute({
  children,
  requiredRole = null,
}: {
  children: React.ReactNode;
  requiredRole?: string | null;
}) {
  const { user, loading, userRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/signin");
    } else if (!loading && requiredRole && userRole !== requiredRole) {
      router.push("/unauthorized");
    }
  }, [loading, user, router, requiredRole, userRole]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return user ? <>{children}</> : null;
}
