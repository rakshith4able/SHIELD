"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";

interface AuthorizationLog {
  id: string;
  authorized: boolean;
  confidence: number;
  ip_address: string;
  recognized_as: string;
  timestamp: string;
  user_email: string;
}

const LogsPage = () => {
  const [logs, setLogs] = useState<AuthorizationLog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchEmail, setSearchEmail] = useState("");
  const [filterAuthorized, setFilterAuthorized] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const logsPerPage = 10;

  // Fetch logs from the backend
  const fetchLogs = async (email = "", authorized: string | null = null) => {
    setLoading(true);
    try {
      const params: any = {};
      if (email) params.email = email;
      if (authorized !== null) params.authorized = authorized;

      const response = await axios.get(
        "http://localhost:5000/admin/authorization_logs",
        {
          params,
        }
      );
      setLogs(response.data);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Pagination logic
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = logs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(logs.length / logsPerPage);

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Search and filter handler
  const handleSearch = () => {
    fetchLogs(searchEmail, filterAuthorized);
    setCurrentPage(1); // Reset to first page after filtering
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Authorization Logs
      </h1>

      {/* Search and Filters */}
      <div className="flex items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="Search by email..."
          value={searchEmail}
          onChange={(e) => setSearchEmail(e.target.value)}
          className="w-1/3 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <select
          value={filterAuthorized || ""}
          onChange={(e) =>
            setFilterAuthorized(e.target.value === "" ? null : e.target.value)
          }
          className="w-1/4 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All</option>
          <option value="true">Authorized</option>
          <option value="false">Unauthorized</option>
        </select>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Apply Filters
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-700 uppercase">
            <tr>
              <th className="px-4 py-3">User Email</th>
              <th className="px-4 py-3">Authorized</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">IP Address</th>
              <th className="px-4 py-3">Recognized As</th>
              <th className="px-4 py-3">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-4">
                  <div className="flex justify-center items-center space-x-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <span>Loading...</span>
                  </div>
                </td>
              </tr>
            ) : currentLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4 text-gray-500">
                  No logs found
                </td>
              </tr>
            ) : (
              currentLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{log.user_email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded ${
                        log.authorized
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {log.authorized ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{log.confidence.toFixed(2)}%</td>
                  <td className="px-4 py-3">{log.ip_address}</td>
                  <td className="px-4 py-3">{log.recognized_as}</td>
                  <td className="px-4 py-3">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-gray-200 text-gray-600 rounded-md hover:bg-gray-300 disabled:opacity-50"
        >
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-4 py-2 bg-gray-200 text-gray-600 rounded-md hover:bg-gray-300 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default LogsPage;
