import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100">
      <h1 className="text-4xl font-bold text-blue-600 mb-6">
        Welcome to S.H.I.E.L.D.
      </h1>
      <p className="text-lg text-gray-700 text-center mb-8 max-w-2xl">
        Secure Human Identification using Enhanced Liveness Detection
        (S.H.I.E.L.D.) is an advanced real-time face authentication system.
        Capture your face images for training and authorize secure access with
        ease.
      </p>

      <div className="flex flex-col space-y-4">
        <Link
          href="/camera"
          className="px-6 py-3 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-700 transition duration-200 text-center"
        >
          Capture your face
        </Link>

        <Link
          href="/recognize"
          className="px-6 py-3 bg-purple-500 text-white rounded-lg shadow-md hover:bg-purple-700 transition duration-200 text-center"
        >
          Face Recognition
        </Link>
      </div>
    </div>
  );
}
