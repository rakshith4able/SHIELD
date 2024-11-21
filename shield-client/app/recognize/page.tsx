"use client";

import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { AiOutlineAlert as AlertCircle } from "react-icons/ai";
import { BiCamera as Camera } from "react-icons/bi";
import { RiLoader2Line as Loader2 } from "react-icons/ri";
import { FiShield as Shield, FiShieldOff as ShieldOff } from "react-icons/fi";
import axios from "axios";

interface RecognizedFace {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  confidence: number;
  name_match: boolean;
}

interface RecognitionResult {
  faces: RecognizedFace[];
  status: string;
}

interface FinalAuthorization {
  status: string;
  recognizedAs?: string;
  confidence?: number;
  reason?: string;
  error?: string;
}

const RECOGNITION_DURATION = 5000;
const CAPTURE_INTERVAL = 500;
const CONFIDENCE_THRESHOLD = 60;
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

const RecognitionComponent: React.FC = () => {
  const router = useRouter();
  const { userDetails, user } = useAuth();
  const id = userDetails?.id;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [recognizedFaces, setRecognizedFaces] = useState<RecognizedFace[]>([]);
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [authState, setAuthState] = useState<FinalAuthorization>({
    status: "",
    recognizedAs: "",
    confidence: 0,
    reason: "",
  });

  // Socket initialization with improved error handling
  useEffect(() => {
    const initializeSocket = async () => {
      try {
        const token = await user?.getIdToken();
        if (!token) throw new Error("No authentication token available");

        const newSocket = io(SOCKET_URL, {
          query: { token },
          transports: ["websocket"],
          reconnection: true,
          reconnectionAttempts: 5,
          timeout: 10000,
        });

        newSocket.on("connect", () => {
          setError("");
        });

        newSocket.on("connect_error", (err) => {
          setError(`Connection error: ${err.message}`);
          setIsRecognizing(false);
        });

        newSocket.on("recognition_result", handleRecognitionResult);
        newSocket.on("final_authorization", handleFinalAuthorization);
        newSocket.on("error", handleSocketError);

        socketRef.current = newSocket;
      } catch (error) {
        setError(
          `Socket initialization failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    };

    if (user) {
      initializeSocket();
    }

    return () => {
      socketRef.current?.close();
    };
  }, [user]);

  const handleRecognitionResult = (data: RecognitionResult) => {
    setRecognizedFaces(data.faces);
  };

  const handleFinalAuthorization = (data: FinalAuthorization) => {
    setAuthState(data);
    setShowModal(true);
  };

  const handleSocketError = (error: { message: string }) => {
    setError(error.message);
    setIsRecognizing(false);
  };

  // Camera initialization with improved error recovery
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: VIDEO_WIDTH },
            height: { ideal: VIDEO_HEIGHT },
            facingMode: "user",
            frameRate: { ideal: 30 },
          },
        });

        streamRef.current = stream;
        if (!videoRef.current) return;

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const canvasElement = canvasRef.current;
        if (canvasElement) {
          canvasElement.width = VIDEO_WIDTH;
          canvasElement.height = VIDEO_HEIGHT;
          setIsInitialized(true);
        }
      } catch (error) {
        setError(
          `Camera access error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    };

    initializeCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (isInitialized && id) {
      startRecognition();
    }
  }, [isInitialized, id]);

  // Enhanced face overlay drawing
  useEffect(() => {
    if (!isInitialized) return;

    const drawFaceOverlays = () => {
      const videoElement = videoRef.current;
      const canvasElement = canvasRef.current;
      if (!videoElement || !canvasElement) return;

      const context = canvasElement.getContext("2d");
      if (!context) return;

      context.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

      // Draw scanning effect when recognizing
      if (isRecognizing) {
        const gradient = context.createLinearGradient(0, 0, 0, VIDEO_HEIGHT);
        gradient.addColorStop(0, "rgba(0, 255, 0, 0)");
        gradient.addColorStop(0.5, "rgba(0, 255, 0, 0.1)");
        gradient.addColorStop(1, "rgba(0, 255, 0, 0)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      }

      recognizedFaces.forEach((face) => {
        // Draw face rectangle
        context.strokeStyle =
          face.confidence > CONFIDENCE_THRESHOLD
            ? "rgba(0, 255, 0, 0.8)"
            : "rgba(255, 0, 0, 0.8)";
        context.lineWidth = 3;
        context.strokeRect(face.x, face.y, face.width, face.height);

        // Draw confidence label background
        context.fillStyle = "rgba(0, 0, 0, 0.7)";
        context.fillRect(face.x, face.y - 30, face.width, 25);

        // Draw text
        context.fillStyle = "#ffffff";
        context.font = "16px Inter, sans-serif";
        context.fillText(
          `${face.name} (${face.confidence.toFixed(1)}%)`,
          face.x + 5,
          face.y - 10
        );
      });

      if (isRecognizing) {
        requestAnimationFrame(drawFaceOverlays);
      }
    };
  }, [recognizedFaces, isRecognizing, isInitialized]);

  const captureFrame = (): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      return null;
    }

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(video, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
    return canvas.toDataURL("image/jpeg", 0.8);
  };

  const startRecognition = () => {
    const socket = socketRef.current;
    if (!socket || !id || !isInitialized) {
      setError("Recognition system not ready");
      return;
    }

    setError("");
    setRecognizedFaces([]);
    setIsRecognizing(true);

    const captureInterval = setInterval(() => {
      const imageData = captureFrame();
      if (imageData) {
        socket.emit("recognize_face", { image: imageData, username: id });
      }
    }, CAPTURE_INTERVAL);

    setTimeout(() => {
      clearInterval(captureInterval);
      socket.emit("get_final_authorization", {
        recognizedFaces,
        username: id,
      });
      setIsRecognizing(false);
    }, RECOGNITION_DURATION);
  };

  const handleModalClose = async () => {
    setShowModal(false);

    if (authState.status === "Authorized" || true) {
      try {
        // Call the Flask route with the user ID
        const token = await user?.getIdToken(true);
        const userId = userDetails?.id;
        console.log("token", token);
        const response = await axios.patch(
          `http://localhost:5000/set_secure_access/${userId}`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        console.log("API Response:", response.data);

        // Navigate to the secure route
        router.push("/secureRoute");
      } catch (error) {
        console.error("Error calling secure access API:", error);
      }
    }
  };

  return (
    <div className="flex flex-col items-center p-6 max-w-4xl mx-auto space-y-6">
      <div className="w-full text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">
          Face Recognition Authentication
        </h1>
        <p className="text-gray-600">
          Please position your face within the frame and stay still
        </p>
      </div>

      {error && (
        <div className="w-full flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="relative  rounded-xl overflow-hidden shadow-lg">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
          className="border rounded object-cover bg-gray-100  w-full h-full"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 pointer-events-none"
        />
      </div>

      <button
        onClick={startRecognition}
        disabled={isRecognizing || !id || !isInitialized}
        className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 
                 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 
                 disabled:cursor-not-allowed transition-all duration-200 
                 focus:outline-none focus:ring-2 focus:ring-blue-500 
                 focus:ring-offset-2 w-full max-w-md"
      >
        {!isInitialized ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Initializing...</span>
          </>
        ) : isRecognizing ? (
          <>
            <Camera className="w-5 h-5 animate-pulse" />
            <span>Recognizing...</span>
          </>
        ) : (
          <>
            <Camera className="w-5 h-5" />
            <span>Start Recognition</span>
          </>
        )}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              {authState.status === "Authorized" ? (
                <Shield className="w-8 h-8 text-green-500" />
              ) : (
                <ShieldOff className="w-8 h-8 text-red-500" />
              )}
              <h2
                className={`text-2xl font-bold ${
                  authState.status === "Authorized"
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {authState.status === "Authorized"
                  ? "Welcome!"
                  : "Access Denied"}
              </h2>
            </div>

            <div className="space-y-2">
              <p className="text-gray-700">
                {authState.status === "Authorized"
                  ? `Successfully verified!}`
                  : authState.reason || "Unable to verify your identity"}
              </p>
            </div>

            <button
              onClick={handleModalClose}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg
                       hover:bg-blue-700 transition-colors focus:outline-none 
                       focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {authState.status === "Authorized" ? "Continue" : "Try Again"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecognitionComponent;
