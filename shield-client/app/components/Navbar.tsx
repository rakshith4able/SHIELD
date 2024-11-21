"use client";

import Link from "next/link";
import { FaSignOutAlt, FaUserCircle } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";

type NavbarProps = {};

function Navbar({}: NavbarProps) {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white p-4 w-full z-10">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-blue-600">
          S.H.I.E.L.D.
        </Link>

        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <div className="flex items-center space-x-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Profile"
                    className="w-8 h-8 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <FaUserCircle className="w-8 h-8 text-gray-500" />
                )}
                <span className="text-gray-700 font-medium">
                  {user.displayName || user.email}
                </span>
              </div>

              <button
                onClick={handleSignOut}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition duration-200"
              >
                <FaSignOutAlt className="w-4 h-4 mr-2" />
                Sign Out
              </button>
            </>
          ) : (
            <Link href="/auth/signin" className="text-sm text-blue-600">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
