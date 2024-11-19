"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { FaGoogle } from "react-icons/fa";
import axios from "axios";

interface VerifyUserResponse {
  authorized: boolean;
  role: string;
}

export default function SignIn() {
  const router = useRouter();
  const [error, setError] = useState("");

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();

      const response = await axios.post<VerifyUserResponse>(
        "http://localhost:5000/verify-user",
        { token },
        { headers: { "Content-Type": "application/json" } }
      );

      const data = response.data;
      if (data.authorized) {
        if (data.role === "admin") {
          router.push("/admin");
        } else {
          router.push("/camera");
        }
      } else {
        setError("Not authorized to access this application");
        await auth.signOut();
      }
    } catch (error) {
      setError("Failed to sign in");
      console.error(error);
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
