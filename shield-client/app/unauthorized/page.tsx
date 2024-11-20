export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center bg-white p-8 rounded-lg shadow-md max-w-sm mx-auto">
        <h1 className="text-4xl font-semibold text-red-500">403</h1>
        <h2 className="mt-2 text-xl font-medium text-gray-800">
          Unauthorized Access
        </h2>
        <p className="mt-4 text-gray-600">
          You do not have permission to view this page. Please contact your
          administrator if you believe this is an error.
        </p>
        <div className="mt-6">
          <a href="/" className="text-blue-500 hover:underline">
            Go back to homepage
          </a>
        </div>
      </div>
    </div>
  );
}
