import Link from "next/link";

function Nav() {
  return (
    <>
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      </header>
      <nav className="bg-white shadow-md p-4 flex space-x-4">
        <Link href="/admin/logs" className="text-blue-600 hover:text-blue-800">
          Logs
        </Link>
        <Link
          href="/admin/manageUsers"
          className="text-blue-600 hover:text-blue-800"
        >
          Manage Users
        </Link>
      </nav>
    </>
  );
}
export default Nav;
