"use client";

import React, { useContext } from "react";
import { FaLock, FaUnlock } from "react-icons/fa"; // Importing the icons
import { useAuth } from "../context/AuthContext"; // assuming you have the auth context

const SecureRouteAccess = () => {
  // Get the user details from context
  const { userDetails } = useAuth();

  // Check if the user can access the secure route
  const canAccess = userDetails?.canAccessSecureRoute;

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="text-center ">
        {canAccess ? (
          <>
            <div className="flex justify-center">
              <FaUnlock className="text-green-500" size={100} />
            </div>
            <p className="text-green-500 text-2xl mt-4">
              Unlocked: You have access to this route.
            </p>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <FaLock className="text-red-500" size={100} />
            </div>
            <p className="text-red-500 text-2xl mt-4">
              Locked: You do not have access to this route.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default SecureRouteAccess;
