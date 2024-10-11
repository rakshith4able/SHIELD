"use client";

import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";

interface RecognizedFace {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  confidence: number;
}

interface RecognitionResult {
  faces: RecognizedFace[];
  status: string;
}

interface FinalAuthorization {
  status: string;
  recognizedAs?: string;
}

const RecognitionComponent: React.FC = () => {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [recognizedFaces, setRecognizedFaces] = useState<RecognizedFace[]>([]);
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [authorizationStatus, setAuthorizationStatus] = useState<string>("");
  const [recognizedAs, setRecognizedAs] = useState<string>("");
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    newSocket.on("recognition_result", (data: RecognitionResult) => {
      setRecognizedFaces(data.faces);
    });

    newSocket.on("final_authorization", (data: FinalAuthorization) => {
      setAuthorizationStatus(data.status);
      setRecognizedAs(data.recognizedAs || "");
      setShowModal(true);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    const getCameraStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing webcam:", error);
      }
    };

    getCameraStream();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const drawOverlay = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const context = canvas.getContext("2d");
      if (!context) return;

      context.clearRect(0, 0, canvas.width, canvas.height);

      // context.strokeStyle = "red";
      // context.fillStyle = "red";
      // context.lineWidth = 2;
      // context.font = "18px Arial";
      // recognizedFaces.forEach((face) => {
      //   context.strokeRect(face.x, face.y, face.width, face.height);
      //   context.fillText(
      //     `${face.name} (${face.confidence.toFixed(2)}%)`,
      //     face.x,
      //     face.y - 5
      //   );
      // });

      requestAnimationFrame(drawOverlay);
    };

    drawOverlay();
  }, [recognizedFaces]);

  const captureAndRecognize = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video || !socket || !username) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    setRecognizedFaces([]);
    setIsRecognizing(true);

    const captureInterval = setInterval(() => {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg");
      socket.emit("recognize_face", { image: imageData, username });
    }, 500);

    setTimeout(() => {
      clearInterval(captureInterval);
      socket.emit("get_final_authorization", { recognizedFaces, username });
      setIsRecognizing(false);
    }, 5000);
  };

  const handleModalClose = () => {
    setShowModal(false);
    if (authorizationStatus === "Authorized") {
      router.push("/");
    }
  };

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Face Recognition</h1>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Enter your username"
        className="mb-4 p-2 border rounded"
      />
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          width={640}
          height={480}
          className="border rounded"
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="absolute top-0 left-0 pointer-events-none"
        />
      </div>
      <button
        onClick={captureAndRecognize}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
        disabled={isRecognizing || !username}
      >
        {isRecognizing ? "Recognizing..." : "Start Recognition"}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg">
            <h2 className="text-2xl font-bold mb-4">
              {authorizationStatus === "Authorized"
                ? "Welcome!"
                : "Access Denied"}
            </h2>
            <p>
              {authorizationStatus === "Authorized"
                ? `You've been recognized as ${recognizedAs}.`
                : "Unable to verify your identity."}
            </p>
            <button
              onClick={handleModalClose}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecognitionComponent;
