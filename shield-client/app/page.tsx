"use client";

import Link from "next/link";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import { useEffect } from "react";

export default function Home() {
  const { userDetails, userRole } = useAuth();

  // Optional: Controlled logging if you need to debug
  useEffect(() => {
    if (userDetails) {
      // Use more informative logging
      console.log("User Details:", {
        name: userDetails.name,
        email: userDetails.email,
        role: userDetails.role,
        isFaceTrained: userDetails.isFaceTrained,
      });
    }
  }, [userDetails]); // Dependency array ensures it only logs when userDetails changes

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100 pt-16">
        <h1 className="text-4xl font-bold text-blue-600 mb-6 text-center">
          Welcome to S.H.I.E.L.D.
        </h1>
        <p className="text-lg text-gray-700 text-center mb-8 max-w-2xl">
          Secure Human Identification using Enhanced Liveness Detection
          (S.H.I.E.L.D.) is an advanced real-time face authentication system.
          Capture your face images for training and authorize secure access with
          ease.
        </p>

        {userDetails ? (
          <>
            {/* Admin Dashboard Button */}
            {userDetails.role === "admin" && (
              <Link
                href="/admin"
                className="px-6 py-3 bg-red-500 text-white rounded-lg shadow-md hover:bg-red-700 transition duration-200 text-center"
              >
                Admin Dashboard
              </Link>
            )}

            {/* User Face Training Button */}
            {userDetails.role === "user" && !userDetails.isFaceTrained && (
              <Link
                href="/camera"
                className="px-6 py-3 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-700 transition duration-200 text-center"
              >
                Train Your Face
              </Link>
            )}

            {/* Secure Route Access Button */}
            {userDetails.role === "user" && userDetails.isFaceTrained && (
              <Link
                href="/recognize"
                className="px-6 py-3 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-200 text-center"
              >
                Access Secure Route
              </Link>
            )}
          </>
        ) : (
          <h1> "lol"</h1>
        )}
      </div>
    </ProtectedRoute>
  );
}
