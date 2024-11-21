import React from "react";
import Link from "next/link";

const AdminPage = () => {
  return (
    <main className="flex-grow p-6">
      <p className="text-gray-700 text-lg">
        Welcome to the Admin Dashboard. Use the navigation above to manage logs
        or users.
      </p>
    </main>
  );
};

export default AdminPage;
