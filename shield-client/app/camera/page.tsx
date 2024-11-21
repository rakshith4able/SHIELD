"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";

const CameraComponent = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { userDetails, user, signOut } = useAuth();
  const id = userDetails?.id;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [detectedFaces, setDetectedFaces] = useState<
    { x: number; y: number; width: number; height: number }[]
  >([]);
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const router = useRouter();
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      const token = await user?.getIdToken();
      const newSocket = io("http://localhost:5000", {
        query: { token },
      });
      setSocket(newSocket);

      newSocket.on("frame_captured", (data) => {
        if (data.faces) {
          setDetectedFaces(data.faces);
        }
        if (data.status) {
          setStatus(data.status);
        }
        if (data.progress) {
          setProgress(data.progress);
        }
      });

      newSocket.on("capture_completed", (data) => {
        setStatus(data.status);
        setDetectedFaces([]);
        setCapturing(false);
        if (captureIntervalRef.current) {
          clearInterval(captureIntervalRef.current);
        }
      });

      newSocket.on("training_completed", (data) => {
        setStatus(
          "Training Completed! Please login again to access the secure route."
        );

        setTimeout(() => {
          signOut();
        }, 5000); // Redirect after 3 seconds
      });

      return () => {
        newSocket.close();
      };
    };

    fetchToken();
  }, [router, user]);

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
  }, []);

  useEffect(() => {
    const drawOverlay = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const context = canvas.getContext("2d");
      if (!context) return;

      // Clear the canvas
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Draw face detection rectangles
      context.strokeStyle = "red";
      context.lineWidth = 2;
      detectedFaces.forEach((face) => {
        context.strokeRect(face.x, face.y, face.width, face.height);
      });

      // Schedule the next frame
      requestAnimationFrame(drawOverlay);
    };

    drawOverlay();
  }, [detectedFaces]);

  const captureFrames = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) {
      console.error("Canvas or video element not found");
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      console.error("Unable to get 2D context from canvas");
      return;
    }

    setCapturing(true);
    setProgress(0);

    captureIntervalRef.current = setInterval(() => {
      // Draw the video frame onto the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg");

      socket?.emit("upload_image", {
        image: imageData,
        face_id: id,
      });
    }, 100);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    captureFrames();
  };

  return (
    <ProtectedRoute>
      <div className="flex flex-col items-center">
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            width="640"
            height="480"
            className="border rounded"
          />
          <canvas
            ref={canvasRef}
            width="640"
            height="480"
            className="absolute top-0 left-0 pointer-events-none"
          />
        </div>
        <form onSubmit={handleSubmit} className="mb-4">
          <button
            type="submit"
            className="ml-2 px-4 py-2 bg-blue-500 text-white rounded"
            disabled={capturing}
          >
            {capturing ? "Capturing..." : "Train Your Face"}
          </button>
        </form>
        {capturing && (
          <div className="mt-4">
            <p>{progress.toPrecision(2)}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${progress.toPrecision(2)}%` }}
              ></div>
            </div>
          </div>
        )}
        {status.toLowerCase().includes("training") && <div>{status}</div>}
      </div>
    </ProtectedRoute>
  );
};

export default CameraComponent;
