"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const RecognitionComponent = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [recognizedFaces, setRecognizedFaces] = useState<any[]>([]);

  useEffect(() => {
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    newSocket.on("recognition_result", (data) => {
      if (data.faces) {
        setRecognizedFaces(data.faces);
      }
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

      // Draw face detection rectangles and names
      context.strokeStyle = "red";
      context.fillStyle = "red";
      context.lineWidth = 2;
      context.font = "18px Arial";
      recognizedFaces.forEach((face) => {
        context.strokeRect(face.x, face.y, face.width, face.height);
        context.fillText(
          `${face.name} (${face.confidence})`,
          face.x,
          face.y - 5
        );
      });

      // Schedule the next frame
      requestAnimationFrame(drawOverlay);
    };

    drawOverlay();
  }, [recognizedFaces]);

  const captureAndRecognize = () => {
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

    const captureAndEmit = () => {
      // Draw the video frame onto the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg");

      socket?.emit("recognize_face", {
        image: imageData,
      });
    };

    // Capture and emit every 500ms
    const intervalId = setInterval(captureAndEmit, 500);

    // Stop after 10 seconds (you can adjust this or remove it for continuous recognition)
    setTimeout(() => clearInterval(intervalId), 10000);
  };

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Face Recognition</h1>
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
      <button
        onClick={captureAndRecognize}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Start Recognition
      </button>
    </div>
  );
};

export default RecognitionComponent;
