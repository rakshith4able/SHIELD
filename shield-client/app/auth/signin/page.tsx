"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaGoogle } from "react-icons/fa";
import axios from "axios";
import { useAuth } from "@/app/context/AuthContext";

interface VerifyUserResponse {
  authorized: boolean;
  role: string;
}

export default function SignIn() {
  const { error, signInWithGoogle, loading } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100">
      <h1 className="text-4xl font-bold text-blue-600 mb-6">Sign In</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <button
        onClick={handleGoogleSignIn}
        className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-700 transition"
      >
        <FaGoogle className="text-2xl mr-2" />
        Sign in with Google
      </button>
    </div>
  );
}
