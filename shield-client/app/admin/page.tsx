"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  FiTrash2 as Trash2,
  FiPlusCircle as PlusCircle,
  FiAlertCircle as AlertCircle,
  FiCheckCircle as CheckCircle2,
  FiXCircle as XCircle,
  FiMail as Mail,
} from "react-icons/fi";
import { ProtectedRoute } from "../components/ProtectedRoute";

interface User {
  id: string;
  email: string;
  createdAt?: string;
}

type ToastType = "success" | "error" | "warning";

const Toast: React.FC<{
  message: string;
  type: ToastType;
  onClose: () => void;
}> = ({ message, type, onClose }) => {
  const typeStyles = {
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-yellow-500",
  };

  const icon = {
    success: <CheckCircle2 />,
    error: <XCircle />,
    warning: <AlertCircle />,
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 p-4 text-white rounded-lg shadow-lg flex items-center ${typeStyles[type]}`}
    >
      {icon[type]}
      <span className="ml-2 mr-4">{message}</span>
      <button onClick={onClose} className="ml-auto">
        <XCircle size={20} />
      </button>
    </div>
  );
};

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const response = await fetch("http://localhost:5000/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch users");

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to fetch users",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const validateGmailAddress = (email: string): boolean => {
    return email.toLowerCase().endsWith("@gmail.com");
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateGmailAddress(newEmail)) {
      showToast("Please enter a valid Gmail address", "error");
      return;
    }

    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const response = await fetch("http://localhost:5000/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: newEmail }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create user");
      }

      await fetchUsers();
      setNewEmail("");
      showToast("User created successfully", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to create user",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const response = await fetch(`http://localhost:5000/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete user");
      }

      await fetchUsers();
      showToast("User deleted successfully", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete user",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        <h1 className="text-3xl font-bold mb-6 text-gray-800">
          User Management
        </h1>

        {/* Create User Form */}
        <form
          onSubmit={createUser}
          className="bg-white shadow-md rounded-lg p-6 mb-6"
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter Gmail address"
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Mail
                  className="absolute left-3 top-2.5 text-gray-400"
                  size={20}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <PlusCircle size={20} />
                <span>Add User</span>
              </div>
            </button>
          </div>
        </form>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Users List */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left text-gray-700">
                    Created At
                  </th>
                  <th className="px-4 py-3 text-right text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="text-center py-4 text-gray-500">
                      <div className="flex justify-center items-center space-x-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        <span>Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-4 text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(u.createdAt || "").toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteUser(u.id)}
                          disabled={loading}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                          title="Delete user"
                        >
                          <Trash2 size={20} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
