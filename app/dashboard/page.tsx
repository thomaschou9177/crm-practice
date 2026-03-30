import { DeleteColumnButton } from '@/components/DeleteColumnButton';
import { DeleteRowButton } from '@/components/DeleteRowButton';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const customers = await prisma.customer.findMany({
    include: { customer_info: true },
    orderBy: { id: 'asc' }
  });

  const allDynamicKeys = Array.from(
    new Set(customers.flatMap((c: { metadata: object; }) => Object.keys((c.metadata as object) || {})))
  );

  // --- SERVER ACTIONS ---

  async function handleLogout() { 'use server'; redirect('/'); }

  async function addCustomer(formData: FormData) {
    'use server';
    const email = formData.get('email') as string;
    await prisma.customer.create({
      data: {
        name: formData.get('name') as string,
        email, 
        role: formData.get('role') as string,
        customer_info: { create: { email } }
      }
    });
    revalidatePath('/dashboard');
  }

  async function updateCoreData(formData: FormData) {
    'use server';
    const id = Number(formData.get('id'));
    const field = formData.get('field') as string;
    const value = formData.get('value') as string;
    await prisma.customer.update({ where: { id }, data: { [field]: value } });
    revalidatePath('/dashboard');
  }

  async function updateMetadataCell(formData: FormData) {
    'use server';
    const id = Number(formData.get('id'));
    const key = formData.get('key') as string;
    const newValue = formData.get('newValue') as string;
    const record = await prisma.customer.findUnique({ where: { id } });
    const meta = (record?.metadata as Record<string, any>) || {};
    await prisma.customer.update({ where: { id }, data: { metadata: { ...meta, [key]: newValue } } });
    revalidatePath('/dashboard');
  }

  async function addOrUpdateColumn(formData: FormData) {
    'use server';
    const id = Number(formData.get('id'));
    const colTitle = formData.get('colTitle') as string;
    const value = formData.get('value') as string;
    if (!colTitle) return;
    const record = await prisma.customer.findUnique({ where: { id } });
    const meta = (record?.metadata as Record<string, any>) || {};
    await prisma.customer.update({ where: { id }, data: { metadata: { ...meta, [colTitle]: value } } });
    revalidatePath('/dashboard');
  }

  async function deleteWholeColumn(formData: FormData) {
    'use server';
    const keyToDelete = formData.get('keyToDelete') as string;
    const allRecords = await prisma.customer.findMany();
    for (const r of allRecords) {
      const meta = (r.metadata as Record<string, any>) || {};
      delete meta[keyToDelete];
      await prisma.customer.update({ where: { id: r.id }, data: { metadata: meta } });
    }
    revalidatePath('/dashboard');
  }

  async function updateSyncEmail(formData: FormData) {
    'use server';
    const infoId = Number(formData.get('infoId'));
    const newEmail = formData.get('newEmail') as string;
    if (!infoId) return;
    await prisma.customer_info.update({ where: { id: infoId }, data: { email: newEmail } });
    revalidatePath('/dashboard');
  }

  async function deleteRow(formData: FormData) {
    'use server';
    await prisma.customer.delete({ where: { id: Number(formData.get('id')) } });
    revalidatePath('/dashboard');
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen text-black text-[10px]">
      <div className="max-w-[98%] mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-tighter">Excel-Style CRM</h1>
          <form action={handleLogout}><button type="submit" className="bg-white border px-4 py-2 rounded font-bold shadow-sm">Logout</button></form>
        </div>

        {/* IMPORT BAR */}
        <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4 flex items-center justify-between">
          <h2 className="font-bold text-green-700 uppercase">Import Spreadsheet</h2>
          <div className="flex gap-2">
            <input type="file" className="bg-white border p-1 rounded" />
            <button className="bg-green-600 text-white px-4 py-2 rounded font-bold">Upload & Sync</button>
          </div>
        </div>

        {/* ADD ROW BAR */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="font-bold mb-3 text-blue-600 uppercase text-[9px]">Add New Customer Row</h2>
          <form action={addCustomer} className="flex gap-2">
            <input name="name" placeholder="Name" className="border p-2 rounded flex-1 outline-none" required />
            <input name="email" placeholder="Email" className="border p-2 rounded flex-1 outline-none" required />
            <input name="role" placeholder="Role" className="border p-2 rounded flex-1 outline-none" required />
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-bold">+ Create Row</button>
          </form>
        </div>

        {/* MAIN TABLE */}
        <div className="bg-white shadow-xl rounded-lg overflow-x-auto border border-gray-200 mb-10">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white uppercase tracking-wider">
                <th className="px-2 py-3 border-r border-gray-700 w-10 text-center">ID</th>
                <th className="px-4 py-3 border-r border-gray-700 text-left">Name</th>
                <th className="px-4 py-3 border-r border-gray-700 text-left">Email</th>
                <th className="px-4 py-3 border-r border-gray-700 text-left">Role</th>
                {allDynamicKeys.map((key) => (
                  <th key={key} className="px-4 py-3 border-r border-gray-700 bg-gray-700 text-left">
                    <div className="flex justify-between items-center gap-2">
                      <span>{key}</span>
                      <form action={deleteWholeColumn}>
                        <input type="hidden" name="keyToDelete" value={key} />
                        <DeleteColumnButton columnName={key} />
                      </form>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 border-r border-gray-700 bg-blue-900 w-48 text-left uppercase text-white">Add Column</th>
                <th className="px-2 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {customers.map((c: any) => {
                const meta = (c.metadata as Record<string, any>) || {};
                return (
                  <tr key={c.id} className="hover:bg-blue-50/20">
                    <td className="px-2 py-4 border-r text-gray-400 font-mono text-center bg-gray-50/10">{c.id}</td>
                    
                    {/* CORE EDITABLE COLUMNS */}
                    {['name', 'email', 'role'].map((field) => (
                      <td key={field} className="p-0 border-r">
                        <form action={updateCoreData} className="flex h-full items-center group">
                          <input type="hidden" name="id" value={c.id} /><input type="hidden" name="field" value={field} />
                          <input name="value" defaultValue={c[field]} className="w-full p-4 bg-transparent outline-none focus:bg-white text-gray-800" />
                        </form>
                      </td>
                    ))}

                    {/* DYNAMIC JSONB CELLS */}
                    {allDynamicKeys.map((key) => (
                      <td key={key} className="p-0 border-r">
                        <form action={updateMetadataCell} className="flex h-full items-center group">
                          <input type="hidden" name="id" value={c.id} /><input type="hidden" name="key" value={key} />
                          <input name="newValue" defaultValue={meta[key] || ""} className="w-full p-4 bg-transparent outline-none focus:bg-white text-blue-700 font-medium" />
                          <button className="hidden group-focus-within:block px-1 text-[8px] text-green-600 font-bold pr-2">Save</button>
                        </form>
                      </td>
                    ))}

                    {/* ADD / FILL COLUMN SPACE */}
                    <td className="p-2 border-r bg-blue-50/30">
                      <form action={addOrUpdateColumn} className="flex flex-col gap-1">
                        <input type="hidden" name="id" value={c.id} />
                        <input name="colTitle" placeholder="Col Title" className="border border-blue-200 p-1 rounded bg-white text-[8px] outline-none" />
                        <div className="flex gap-1">
                          <input name="value" placeholder="Value" className="border border-blue-200 p-1 rounded bg-white flex-1 text-[8px] outline-none" />
                          <button type="submit" className="bg-blue-600 text-white px-2 py-1 rounded font-bold text-[8px]">Save</button>
                        </div>
                      </form>
                    </td>

                    <td className="px-4 py-4 text-right">
                      <form action={deleteRow}><input type="hidden" name="id" value={c.id} /><DeleteRowButton /></form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* EDITABLE DATABASE SYNC TABLE */}
        <h2 className="text-sm font-bold mb-3 text-indigo-900 uppercase">Database Sync (customer_info)</h2>
        <div className="bg-white shadow rounded border border-indigo-100 max-w-md overflow-hidden">
          <table className="min-w-full text-left">
            <thead className="bg-indigo-900 text-white uppercase text-[8px]">
              <tr>
                <th className="px-4 py-2 border-r border-indigo-800">Sync ID</th>
                <th className="px-4 py-2">Email Record (Editable)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c: any) => (
                <tr key={`sync-${c.id}`} className="hover:bg-indigo-50/30">
                  <td className="px-4 py-2 font-mono text-gray-400 border-r border-gray-100">ID {c.id}</td>
                  <td className="p-0">
                    <form action={updateSyncEmail} className="flex h-full items-center group">
                      <input type="hidden" name="infoId" value={c.customer_info?.id} />
                      <input 
                        name="newEmail" 
                        defaultValue={c.customer_info?.email || ""} 
                        className="w-full px-4 py-2 bg-transparent outline-none focus:bg-white text-indigo-700 font-medium" 
                      />
                      <button className="hidden group-focus-within:block px-2 text-[8px] text-indigo-400 font-bold">Sync</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}