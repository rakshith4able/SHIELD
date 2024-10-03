"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";

const CameraComponent = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [userName, setUserName] = useState<string>("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [detectedFaces, setDetectedFaces] = useState<
    { x: number; y: number; width: number; height: number }[]
  >([]);
  const router = useRouter();
  const MAX_FRAMES = 30;

  useEffect(() => {
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    newSocket.on("frame_captured", (data) => {
      if (data.faces) {
        setDetectedFaces(data.faces);
      }
      if (data.completed) {
        setCapturing(false);
        router.push("/");
      }
    });

    return () => {
      newSocket.close();
    };
  }, [router]);

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

    let frameCount = 0;

    setCapturing(true);

    const intervalId = setInterval(() => {
      if (frameCount >= MAX_FRAMES) {
        clearInterval(intervalId);
        return;
      }

      // Draw the video frame onto the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg");

      socket?.emit("upload_image", {
        image: imageData,
        face_id: userName,
      });

      frameCount++;
    }, 100);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    captureFrames();
  };

  return (
    <div className="flex flex-col items-center">
      <form onSubmit={handleSubmit} className="mb-4">
        <input
          type="text"
          placeholder="Enter your name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          required
          className="border border-gray-300 rounded p-2"
        />
        <button
          type="submit"
          className="ml-2 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Start Capturing
        </button>
      </form>
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
      {capturing && <p>Capturing frames... Please wait.</p>}
    </div>
  );
};

export default CameraComponent;
