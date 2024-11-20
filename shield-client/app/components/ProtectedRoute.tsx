"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";

export function ProtectedRoute({
  children,
  requiredRole = null,
}: {
  children: React.ReactNode;
  requiredRole?: string | null;
}) {
  const { user, loading, userRole } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/signin");
    } else if (!loading && requiredRole && userRole !== requiredRole) {
      router.push("/unauthorized");
    } else {
      setIsLoading(false); // Once the authentication/role check is done, stop loading
    }
  }, [loading, user, router, requiredRole, userRole]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500"></div>
        <span className="ml-4">Loading...</span>
      </div>
    );
  }

  return user ? <>{children}</> : null;
}
