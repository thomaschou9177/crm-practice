import { prisma } from '@/lib/db';
import { customer, customer_info } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
export default async function DashboardPage() {
  // 1. Fetch data with the relation included
  const customers = await prisma.customer.findMany({
    include: {
      customer_info: true,
    },
  });

  // Define a type for the joined data
  type CustomerWithInfo = customer & {
    customer_info: customer_info | null;
  };

  // Action to refresh the page after adding
  async function addData(formData: FormData) {
    'use server';
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;
    const altEmail = formData.get('altEmail') as string;

    await prisma.customer.create({
      data: {
        name,
        email,
        role,
        customer_info: {
          create: { email: altEmail }
        }
      }
    });
    revalidatePath('/dashboard');
  }

  // Action to Delete
  async function deleteCustomer(formData: FormData) {
    'use server';
    const id = Number(formData.get('id'));

    // If you didn't add onDelete: Cascade to schema, 
    // you must delete customer_info manually first:
    await prisma.customer_info.deleteMany({ where: { id } });
    await prisma.customer.delete({ where: { id } });

    revalidatePath('/dashboard');
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen text-black">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">CRM Dashboard</h1>
          <Link href="/" className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition">
            Logout
          </Link>
        </div>

        {/* ADD DATA FORM */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-8 border border-gray-200">
          <h2 className="text-lg font-bold mb-4">Add New Customer & Info</h2>
          <form action={addData} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input name="name" placeholder="Name" className="border p-2 rounded" required />
            <input name="email" type="email" placeholder="Primary Email" className="border p-2 rounded" required />
            <input name="role" placeholder="Role (e.g. Admin)" className="border p-2 rounded" required />
            <input name="altEmail" type="email" placeholder="Alt Email (Info Table)" className="border p-2 rounded" required />
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-bold">
              Add Both
            </button>
          </form>
        </div>

        {/* Primary Customer Table */}
        <h2 className="text-xl font-semibold mb-4">Core Customers</h2>
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100 mb-12">
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
              {customers.map((c:CustomerWithInfo) => (
                <tr key={c.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">{c.id}</td>
                  <td className="px-6 py-4 text-sm font-medium">{c.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-bold uppercase">
                      {c.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <form action={deleteCustomer}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="text-red-600 hover:text-red-800 font-semibold text-sm">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Secondary Customer Info Table */}
        <h2 className="text-xl font-semibold mb-4">customer_info</h2>
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-indigo-900 text-white">
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase">Customer ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c:CustomerWithInfo) => (
                <tr key={`info-${c.id}`} className="hover:bg-indigo-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">{c.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {c.customer_info?.email || <span className="text-gray-400 italic">No record found</span>}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {c.customer_info ? (
                      <span className="text-green-600 font-semibold">Linked</span>
                    ) : (
                      <span className="text-red-400">Missing</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {customers.length === 0 && (
            <div className="p-10 text-center text-gray-500">
              <p>No data found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}