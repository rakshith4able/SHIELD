import React from "react";
import { Inter } from "next/font/google";
import Nav from "./Nav";

const inter = Inter({ subsets: ["latin"] });

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1">
      <Nav />
      <main className="p-4">{children}</main>
    </div>
  );
}
