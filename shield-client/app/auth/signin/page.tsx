"use client";

import { useState } from "react";
import { FaGoogle } from "react-icons/fa";
import { useAuth } from "@/app/context/AuthContext";
import { AxiosError } from "axios";

export default function SignIn() {
  const { error, signInWithGoogle, loading } = useAuth();
  const [serverError, setServerError] = useState<{
    message: string;
    errorCode?: string;
  } | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithGoogle();

      // Check if result is an AxiosError with a response
      if (result instanceof Error && "response" in result) {
        const axiosError = result as AxiosError<{
          message?: string;
          errorCode?: string;
        }>;

        const errorCode = axiosError.response?.data?.errorCode;
        const message = axiosError.response?.data?.message;

        // Handle specific error codes
        switch (errorCode) {
          case "FIRST_TIME_LOGIN":
            setServerError({
              message: message || "First-time login requires additional setup.",
              errorCode,
            });
            break;
          case "USER_NOT_FOUND":
            setServerError({
              message: message || "User not found in the system.",
              errorCode,
            });
            break;
          case "INVALID_TOKEN":
            setServerError({
              message: message || "Invalid authentication token.",
              errorCode,
            });
            break;
          default:
            setServerError({
              message: message || "An unexpected error occurred.",
              errorCode: errorCode || "UNKNOWN_ERROR",
            });
        }
      }
    } catch (err) {
      console.error(err);
      setServerError({
        message: "Authentication failed. Please try again.",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100">
      <h1 className="text-4xl font-bold text-blue-600 mb-6">Sign In</h1>

      {/* Client-side error */}
      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
          role="alert"
        >
          <span className="block sm:inline">{error.message}</span>
        </div>
      )}

      {/* Server-side error with persistent display */}
      {!error && serverError && (
        <div
          className={`
            mb-4 px-4 py-3 rounded relative 
            ${
              serverError.errorCode === "FIRST_TIME_LOGIN"
                ? "bg-yellow-100 border-yellow-400 text-yellow-700"
                : "bg-red-100 border-red-400 text-red-700"
            }
          `}
          role="alert"
        >
          <span className="block sm:inline">{serverError.message}</span>
          {serverError.errorCode === "FIRST_TIME_LOGIN" && (
            <p className="text-sm mt-2">
              Please sign in again to activate your account privileges.
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
      >
        <FaGoogle className="text-2xl mr-2" />
        {loading ? "Signing in..." : "Sign in with Google"}
      </button>
    </div>
  );
}
