"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const CameraComponent: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faceId, setFaceId] = useState<string>("");
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io("http://localhost:5000"); // Adjust the URL based on your Flask app
    setSocket(newSocket);

    newSocket.on("frame_captured", (data) => {
      console.log("Frame captured:", data);
      if (data.completed) {
        // Stop capturing if completed
        setIsCapturing(false);
      }
    });

    return () => {
      newSocket.disconnect();
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
  }, []);

  const captureFrame = async () => {
    if (!canvasRef.current || !videoRef.current || !isCapturing) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext("2d");

    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg");

      // Send the image data to the Next.js API route
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imageData,
          face_id: faceId,
        }),
      });

      const result = await response.json();
      console.log("Response from API:", result);

      // Emit the image data through the WebSocket
      socket?.emit("upload_image", {
        image: imageData,
        face_id: faceId,
      });
    }
  };

  const startCapturing = () => {
    setIsCapturing(true);
  };

  return (
    <div className="flex flex-col items-center">
      <input
        type="text"
        placeholder="Enter face ID"
        value={faceId}
        onChange={(e) => setFaceId(e.target.value)}
        className="mb-4 p-2 border border-gray-300 rounded"
      />
      <video ref={videoRef} autoPlay width="640" height="480" />
      <canvas
        ref={canvasRef}
        style={{ display: "none" }}
        width="640"
        height="480"
      />
      <button
        onClick={startCapturing}
        className="mt-4 p-2 bg-blue-500 text-white rounded"
      >
        Start Capturing
      </button>
      <button
        onClick={captureFrame}
        className="mt-4 p-2 bg-green-500 text-white rounded"
      >
        Capture Frame
      </button>
    </div>
  );
};

export default CameraComponent;
