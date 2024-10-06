"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";

export default function Train() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    newSocket.on("training_started", (data) => {
      setStatus(data.status);
      setError(null);
    });

    newSocket.on("training_completed", (data) => {
      setStatus(data.status);
      setError(null);
      setTimeout(() => router.push("/"), 3000); // Redirect after 3 seconds
    });

    newSocket.on("training_error", (data) => {
      setStatus("Training failed.");
      setError(data.status);
    });

    return () => {
      newSocket.close();
    };
  }, [router]);

  const handleStartTraining = () => {
    setError(null);
    socket?.emit("start_training");
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100">
      <h1 className="text-4xl font-bold text-blue-600 mb-6">Train Model</h1>
      <button
        onClick={handleStartTraining}
        className="px-6 py-3 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-200"
      >
        Start Training
      </button>
      {status && <p className="mt-4 text-lg">{status}</p>}
      {error && <p className="mt-4 text-lg text-red-500">Error: {error}</p>}
    </div>
  );
}
