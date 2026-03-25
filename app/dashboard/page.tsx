import { prisma } from '@/lib/db';
import Link from 'next/link';
// 1. Import the type from Prisma Client
import { customer } from "@prisma/client";

export default async function DashboardPage() {
  // Fetch data from your PostgreSQL 'customer' table
  const customers = await prisma.customer.findMany();

  return (
    <div className="p-8 bg-gray-50 min-h-screen text-black">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">CRM Dashboard</h1>
          <Link 
            href="/" 
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
          >
            Logout
          </Link>
        </div>

        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase">ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c:customer) => (
                <tr key={c.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">{c.id}</td>
                  <td className="px-6 py-4 text-sm font-medium">{c.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-bold uppercase">
                      {c.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {customers.length === 0 && (
            <div className="p-10 text-center text-gray-500">
              <p>The database is currently empty.</p>
              <p className="text-xs mt-2">Add data in PostgreSQL to see it here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}