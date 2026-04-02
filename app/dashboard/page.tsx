export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { DeleteColumnButton } from '@/components/DeleteColumnButton';
import { DeleteRowButton } from '@/components/DeleteRowButton';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// FIXED: Removed the extra '{' that caused the "Expression expected" error
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
 })
 {
 // ✅ await 解開 Promise
  const params = await searchParams;

  // 固定欄位
  const { id, name, email, role, syncId, syncEmail } = params;

  // --- FETCH ALL DATA ---
  const allCustomers = await prisma.customer.findMany({
    include: { customer_info: true },
    orderBy: { id: 'asc' },
  });

  const allSyncRecords = await prisma.customer_info.findMany({
    orderBy: { id: 'asc' },
  });

  // 動態 metadata keys
  const allDynamicKeys = Array.from(
    new Set(allCustomers.flatMap((c: any) => Object.keys((c.metadata as object) || {})))
  );

  // 判斷是否有啟用過濾
  const isCustomerFiltering = Object.entries({ id, name, email, role, ...Object.fromEntries(allDynamicKeys.map(k => [k, params[k]])) })
    .some(([_, v]) => v && v.trim() !== "");

  const isSyncFiltering = !!(syncId || syncEmail);

  // 建構 Prisma where 條件
  const customerWhere: any = { AND: [] };

  if (id && !isNaN(Number(id))) {
    customerWhere.AND.push({ id: Number(id) });
  }
  if (name && name.trim() !== "") {
    customerWhere.AND.push({ name: { contains: name, mode: 'insensitive' } });
  }
  if (email && email.trim() !== "") {
    customerWhere.AND.push({ email: { contains: email, mode: 'insensitive' } });
  }
  if (role && role.trim() !== "") {
    customerWhere.AND.push({ role: { contains: role, mode: 'insensitive' } });
  }

  // ✅ 動態 metadata 條件
  for (const key of allDynamicKeys) {
    const value = params[key];
    if (value && value.trim() !== "") {
      customerWhere.AND.push({ metadata: { path: [key], string_contains: value } });
    }
  }

  const syncWhere: any = {
    AND: [
      syncId ? { id: Number(syncId) } : {},
      syncEmail ? { email: { contains: syncEmail, mode: 'insensitive' } } : {},
    ],
  };

  // --- FILTERED DATA ---
  const filteredCustomers = isCustomerFiltering
    ? await prisma.customer.findMany({
        where: customerWhere,
        include: { customer_info: true },
        orderBy: { id: 'asc' },
      })
    : [];

  const filteredSyncRecords = isSyncFiltering
    ? await prisma.customer_info.findMany({
        where: syncWhere,
        orderBy: { id: 'asc' },
      })
    : [];

  console.log("Full searchParams:", params);
  console.log({
    isCustomerFiltering,
    idValue: id,
    count: filteredCustomers.length,
    whereClause: JSON.stringify(customerWhere),
  });
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

  async function handleTableSearch(formData: FormData) {
    'use server';
    // Create a fresh params object to ensure a clean URL
    const params = new URLSearchParams();
    
    // Only add fields that have an actual value
    formData.forEach((value, key) => {
      if (value && value.toString().trim() !== "") {
        params.set(key, value.toString());
      }
    });
    redirect(`/dashboard?${params.toString()}`);
  }

  async function handleSyncSearch(formData: FormData) {
    'use server';
    const params = new URLSearchParams();
    // Remove table filters when updating sync filters
    // ['id','name','email','role','age','birthday','education'].forEach(k => params.delete(k));
    // Only add fields that have an actual value
    formData.forEach((value, key) => {
      if (value && value.toString().trim() !== "") {
        params.set(key, value.toString());
      }
    });
    redirect(`/dashboard?${params.toString()}`);
  }

  async function clearFilters() {
    'use server';
    redirect('/dashboard');
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

        {/* 1. FILTER FOR CUSTOMER TABLE */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-indigo-600 uppercase text-[9px]">Table Filter (Customer Data)</h2>
            <form action={clearFilters}><button className="text-gray-400 hover:text-red-500 underline text-[8px]">Clear Table Filters</button></form>
          </div>
          <form action={handleTableSearch} className="grid grid-cols-8 gap-2">
            <input name="id" placeholder="ID" className="border p-2 rounded" defaultValue={id} />
            <input name="name" placeholder="Name" className="border p-2 rounded" defaultValue={name} />
            <input name="email" placeholder="Email" className="border p-2 rounded" defaultValue={email} />
            <input name="role" placeholder="Role" className="border p-2 rounded" defaultValue={role} />
            {/* ✅ 動態 metadata filter inputs */}
            {allDynamicKeys.map((key) => (
              <input
                key={key}
                name={key}
                placeholder={`Meta: ${key}`}
                className="border p-2 rounded bg-blue-50"
                defaultValue={params[key]}
              />
            ))}
            <button type="submit" className="bg-indigo-600 text-white rounded font-bold uppercase">Table Search 🔍</button>
          </form>
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
        {/* DEBUG OVERRIDE */}
<div className="bg-yellow-100 p-2 mb-4 border border-yellow-400 text-black">
  <p>Filter Active: {isCustomerFiltering ? "YES" : "NO"}</p>
  <p>URL ID: {id}</p>
  <p>Matches Found: {filteredCustomers.length}</p>
</div>

{isCustomerFiltering && (
  <div className="mb-10 animate-in fade-in duration-500">
    {/* ... rest of your existing filtered table code ... */}
    {filteredCustomers.length === 0 && (
      <div className="p-10 text-center bg-white border-2 border-dashed border-indigo-200 text-gray-400">
        The filter is active, but Prisma found 0 matches in the database.
      </div>
    )}
  </div>
)}
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
              {allCustomers.map((c: any) => {
                const meta = (c.metadata as Record<string, any>) || {};
                return (
                  <tr key={c.id} className="hover:bg-blue-50/20">
                    <td className="px-2 py-4 border-r text-gray-400 font-mono text-center bg-gray-50/10">{c.id}</td>
                    {['name', 'email', 'role'].map((field) => (
                      <td key={field} className="p-0 border-r">
                        <form action={updateCoreData} className="flex h-full items-center group">
                          <input type="hidden" name="id" value={c.id} /><input type="hidden" name="field" value={field} />
                          <input name="value" defaultValue={c[field]} className="w-full p-4 bg-transparent outline-none focus:bg-white text-gray-800" />
                        </form>
                      </td>
                    ))}
                    {allDynamicKeys.map((key) => (
                      <td key={key} className="p-0 border-r">
                        <form action={updateMetadataCell} className="flex h-full items-center group">
                          <input type="hidden" name="id" value={c.id} /><input type="hidden" name="key" value={key} />
                          <input name="newValue" defaultValue={meta[key] || ""} className="w-full p-4 bg-transparent outline-none focus:bg-white text-blue-700 font-medium" />
                          <button className="hidden group-focus-within:block px-1 text-[8px] text-green-600 font-bold pr-2">Save</button>
                        </form>
                      </td>
                    ))}
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

{/* 3. FILTERED RESULTS (CUSTOMER) */}
<div className="mb-10 animate-in fade-in duration-500">
  <div className="bg-indigo-600 text-white p-2 rounded-t-lg flex justify-between items-center border-x-2 border-t-2 border-indigo-600">
    <h2 className="font-bold uppercase text-[9px] flex items-center gap-2">
      <span className="bg-white text-indigo-600 px-2 py-0.5 rounded-full">Results</span>
      Customer Search Match ({filteredCustomers.length})
    </h2>
  </div>
  <div className="bg-white shadow-2xl rounded-b-lg overflow-x-auto border-2 border-indigo-600 border-t-0">
    {filteredCustomers.length > 0 ? (
      <table className="min-w-full border-collapse">
        <thead className="bg-indigo-50 text-indigo-900 uppercase text-[8px]">
          <tr>
            <th className="px-2 py-2 border-r border-indigo-100 w-10 text-center">ID</th>
            <th className="px-4 py-2 border-r border-indigo-100">Name</th>
            <th className="px-4 py-2 border-r border-indigo-100">Email</th>
            <th className="px-4 py-2">Role</th>
            {/* ✅ 動態 metadata 欄位 */}
            {allDynamicKeys.map((key) => (
              <th key={key} className="px-4 py-2 border-r border-indigo-100">{key}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filteredCustomers.map((c: any) => {
            const meta = (c.metadata as Record<string, any>) || {};
            return(
            <tr key={`filtered-cust-${c.id}`} className="hover:bg-indigo-50/50">
              <td className="px-2 py-2 border-r text-center font-mono text-gray-400">{c.id}</td>
              <td className="px-4 py-2 border-r font-medium">{c.name}</td>
              <td className="px-4 py-2 border-r text-indigo-700">{c.email}</td>
              <td className="px-4 py-2 text-gray-600">{c.role}</td>
              {/* ✅ 動態 metadata 值 */}
                {allDynamicKeys.map((key) => (
                  <td key={key} className="px-4 py-2 border-r text-blue-700 font-medium">
                    {meta[key] || ""}
                  </td>
                ))}
            </tr>
            )
          })}
        </tbody>
      </table>
    ) : (
      <div className="p-10 text-center bg-white border-2 border-dashed border-indigo-200 text-gray-400">
        The filter is active, but Prisma found 0 matches in the database.
      </div>
    )}
  </div>
</div>

        {/* 2. FILTER FOR SYNC TABLE */}
        <div className="bg-indigo-50 p-4 rounded border border-indigo-100 mb-4">
          <h2 className="text-[9px] font-bold text-indigo-900 uppercase mb-2">Sync Filter (customer_info)</h2>
          <form action={handleSyncSearch} className="flex gap-2 max-w-2xl">
            <input name="syncId" placeholder="Filter Sync ID" className="border p-2 rounded flex-1 bg-white" defaultValue={syncId} />
            <input name="syncEmail" placeholder="Filter Sync Email" className="border p-2 rounded flex-1 bg-white" defaultValue={syncEmail} />
            <button type="submit" className="bg-indigo-900 text-white px-6 rounded font-bold uppercase">Sync Search 🔍</button>
          </form>
        </div>
        {/* SYNC TABLE */}
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
              {allSyncRecords.map((c: any) => (
                <tr key={`sync-${c.id}`} className="hover:bg-indigo-50/30">
                  <td className="px-4 py-2 font-mono text-gray-400 border-r border-gray-100">ID {c.id}</td>
                  <td className="p-0">
                    <form action={updateSyncEmail} className="flex h-full items-center group">
                      <input type="hidden" name="infoId" value={c.id} />
                      <input 
                        name="newEmail" 
                        defaultValue={c.email || ""} 
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
{/* 4. FILTERED RESULTS (SYNC) */}
<div className="mt-6 animate-in slide-in-from-top-2 duration-300 max-w-md">
  <div className="bg-amber-500 text-white px-4 py-2 rounded-t font-bold uppercase text-[8px] flex justify-between">
    <span>Filtered Sync Results</span>
    <span>{filteredSyncRecords.length} Found</span>
  </div>
  <div className="bg-white shadow border-2 border-amber-500 rounded-b overflow-hidden">
    {filteredSyncRecords.length > 0 ? (
      <table className="min-w-full text-[9px]">
        <tbody className="divide-y divide-amber-100">
          {filteredSyncRecords.map((s: any) => (
            <tr key={`filtered-sync-${s.id}`} className="bg-amber-50/20">
              <td className="px-4 py-2 font-mono text-amber-700 border-r border-amber-100">ID {s.id}</td>
              <td className="px-4 py-2 italic text-gray-700">{s.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div className="p-6 text-center bg-white border-2 border-dashed border-amber-200 text-gray-400">
        The sync filter is active, but Prisma found 0 matches in the database.
      </div>
    )}
  </div>
</div>

      </div>
    </div>
  );
}