// app/dashboard/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import DeleteAllDataButton from '@/components/DeleteAllDataButton';
import { DeleteColumnButton } from '@/components/DeleteColumnButton';
import { DeleteRowButton } from '@/components/DeleteRowButton';
import EditableInput from '@/components/EditableInput';
import ImportBar from '@/components/ImportBar';
import JumpToPage from '@/components/JumpToPage';
import TenantGuard from '@/components/TenantGuard';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers'; // 1. 引入 cookies
import { addCustomer, addOrUpdateColumn, clearFilters, deleteRow, deleteWholeColumn, handleLogout, handleSyncSearch, handleTableSearch, updateCoreData, updateMetadataCell, updateSyncEmail } from './actions';
export default async function DashboardPage(props:{
  searchParams: Promise<Record<string, string | undefined>>; //把 searchParams 的型別明確指定成 Record<string, string | undefined>
 })
 {
  // 3. 權限檢查邏輯
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.get('isLoggedIn')?.value==='true';
  const authTenant = cookieStore.get('auth_tenant')?.value;

  // 如果沒登入，或是登入的不是 public，強制踢回根目錄 /

  // if (!isLoggedIn || !authTenant) {
  //   redirect('/');
  // }

  // 如果登入租戶不是 'public'，導向到該租戶正確的 dashboard

  // if (authTenant !== 'public') {
  //   redirect(`/${authTenant}/dashboard`);
  // }

  // ✅ await 解開 Promise
  const params: Record<string, string | undefined> =await props.searchParams;
  // --- 新增：分頁參數計算 ---
  const pageSize = 50; // 每頁顯示 50 筆
  const currentPage = Number(params.page) || 1;
  const skip = (currentPage - 1) * pageSize;
  // --- 新增：針對 customer_info 的分頁 ---
  const syncPageSize = 50;
  const currentSyncPage = Number(params.syncPage) || 1;
  const syncSkip = (currentSyncPage - 1) * syncPageSize;
  
 // 固定欄位過濾參數
  const { id, name, email, role, syncId, syncEmail} = params;

  // --- FETCH ALL DATA ---
  // --- 修改：增加 skip 與 take ---
  // 僅抓取當前頁面的資料以確保效能
  const allCustomers = await prisma.customer.findMany({
    include: { customer_info: true },
    orderBy: { id: 'asc' },
    skip: skip,   // 跳過前面的資料
    take: pageSize // 只取出 50 筆
  });
  // 取得總筆數以計算總頁數
  const totalCount = await prisma.customer.count();
  const totalPages = Math.ceil(totalCount / pageSize);
  // 取得 customer_info 總筆數
  const totalSyncCount = await prisma.customer_info.count();
  const totalSyncPages = Math.ceil(totalSyncCount / syncPageSize);
  
  const allSyncRecords = await prisma.customer_info.findMany({
    orderBy: { id: 'asc' },
    skip: syncSkip,
    take: syncPageSize,
  });

  // 動態 metadata keys
   // ✅ 將 metadata key 統一轉成小寫
  const allDynamicKeys: string[] = Array.from(
    new Set(
      allCustomers.flatMap((c: any) =>
        Object.keys((c.metadata as Record<string, any>) || {}).map(k => k.toLowerCase())
      )
    )
  );

  // 判斷是否有啟用過濾
  const isCustomerFiltering = Object.entries({ id, name, email, role, ...Object.fromEntries(allDynamicKeys.map((k:string) => [k, params[k] as string | undefined])),
   } as Record<string, string | undefined>)
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

  // ✅ 動態 metadata 條件 (自動判斷數字/字串)
  
// 動態 metadata keys 統一小寫
// 查詢條件
for (const key of allDynamicKeys) {
  const value = params[key];
  if (value && value.trim() !== '') {
    const normalizedKey = key.toLowerCase();
    const numVal = Number(value);

    if (!isNaN(numVal) && value.trim() === numVal.toString()) {
      customerWhere.AND.push({
        OR: [
          { metadata: { path: [normalizedKey], equals: numVal } },
          { metadata: { path: [normalizedKey], equals: value } }
        ]
      });
    } else {
      customerWhere.AND.push({
        metadata: { path: [normalizedKey], equals: value },
      });
    }
  }
}



  const syncWhere: any = {
    AND: [
      syncId ? { id: Number(syncId) } : {},
      syncEmail ? { email: { contains: syncEmail, mode: 'insensitive' } } : {},
    ],
  };
  const filteredPageSize = 50;
  const currentFilteredPage = Number(params.filteredPage) || 1;
  const filteredSkip = (currentFilteredPage - 1) * filteredPageSize;
  // --- FILTERED DATA ---
  const filteredCustomers = isCustomerFiltering
    ? await prisma.customer.findMany({
        where: customerWhere,
        include: { customer_info: true },
        orderBy: { id: 'asc' },
        skip: filteredSkip,
        take: filteredPageSize,
      })
    : [];
  const filteredTotalCount = isCustomerFiltering
  ? await prisma.customer.count({ where: customerWhere })
  : 0;
  const filteredTotalPages = Math.ceil(filteredTotalCount / filteredPageSize);
  
  const filteredSyncPageSize = 50; // 每頁顯示 50 筆
  const currentFilteredSyncPage = Number(params.filteredSyncPage) || 1;
  const filteredSyncSkip = (currentFilteredSyncPage - 1) * filteredSyncPageSize;
  const filteredSyncRecords = isSyncFiltering
    ? await prisma.customer_info.findMany({
        where: syncWhere,
        orderBy: { id: 'asc' },
        skip: filteredSyncSkip,
        take: filteredSyncPageSize,
      })
    : [];
  // 計算總筆數與總頁數
  const filteredSyncTotalCount = isSyncFiltering
    ? await prisma.customer_info.count({ where: syncWhere })
    : 0;
  const filteredSyncTotalPages = Math.ceil(filteredSyncTotalCount / filteredSyncPageSize);
  console.log("Full searchParams:", params);
  console.log({
    isCustomerFiltering,
    idValue: id,
    count: filteredCustomers.length,
    whereClause: JSON.stringify(customerWhere),
  });
 // 輔助函式：產生保留現有參數的 URL
  const createURL = (name: string, value: string | number) => {
    const newParams = new URLSearchParams();
    // 過濾掉 undefined
    Object.entries(params).forEach(([k, v]) => {
    if (typeof v === "string") {
      newParams.set(k, v);
    }
    });
    newParams.set(name, value.toString());
    return `/dashboard?${newParams.toString()}`;
  };
  
  return (
    <div className="p-8 bg-gray-50 min-h-screen text-black text-[10px]">
      <div className="max-w-[98%] mx-auto">
        {/* 放入 TenantGuard，它會監控 URL 參數 */}
        <TenantGuard currentTenant="public" />
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-tighter">Excel-Style CRM</h1>
          <form action={() => handleLogout('public')}><button type="submit" className="bg-white border px-4 py-2 rounded font-bold shadow-sm">Logout</button></form>
        </div>

{/* IMPORT BAR */}

<ImportBar></ImportBar>

{/* <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4 flex items-center justify-between">
  <h2 className="font-bold text-green-700 uppercase">Import Excel File</h2>
  <form
    action="/api/upload"
    method="post"
    encType="multipart/form-data"
    className="flex gap-2"
  >
    <input
      type="file"
      name="file"
      accept=".xlsx,.xls"
      className="bg-white border p-1 rounded"
      required
    />
    <button
      type="submit"
      className="bg-green-600 text-white px-4 py-2 rounded font-bold"
    >
      Upload & Sync
    </button>
  </form>
</div> */}




        {/* 1. FILTER FOR CUSTOMER TABLE */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-indigo-600 uppercase text-[9px]">Table Filter (Customer Data)</h2>
            <form action={clearFilters}><button className="text-gray-400 hover:text-red-500 underline text-[8px]">Clear Table Filters</button></form>
          </div>
          <form action={handleTableSearch} className="grid grid-cols-8 gap-2">
            {/* 關鍵：把目前的 params 轉成字串傳給後端 */}
            <input type="hidden" name="currentSearchParams" value={new URLSearchParams(params as any).toString()} />
            <input type="hidden" name="tenant" value="public" />
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
                defaultValue={params[key] }
              />
            ))}
            <button type="submit" className="bg-indigo-600 text-white rounded font-bold uppercase">Table Search 🔍</button>
          </form>
        </div>

        {/* ADD ROW BAR */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="font-bold mb-3 text-blue-600 uppercase text-[9px]">Add New Customer</h2>
          <form action={addCustomer} className="flex gap-2">
            <input name="id" placeholder="id" className="border p-2 rounded flex-1 outline-none" required />
            <input name="name" placeholder="Name" className="border p-2 rounded flex-1 outline-none" required />
            <input name="email" placeholder="Email" className="border p-2 rounded flex-1 outline-none" required />
            <input name="role" placeholder="Role" className="border p-2 rounded flex-1 outline-none" required />
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-bold">+ Create</button>
          </form>
        </div>
        {/* DEBUG OVERRIDE */}    
        
{/* <div className="bg-yellow-100 p-2 mb-4 border border-yellow-400 text-black">
  <p>Filter Active: {isCustomerFiltering ? "YES" : "NO"}</p>
  <p>URL ID: {id}</p>
  <p>Matches Found: {filteredCustomers.length}</p>
</div> */}

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

<div className="flex justify-between items-end mb-2">
  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-tight">
    Customer Table 
    <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
      Total: {totalCount} records
    </span>
  </h2>

  {/* 簡易換頁顯示 */}
  <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500">
    <span>PAGE {currentPage} / {totalPages}</span>
  </div>
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
              {allCustomers.map((c: any) => {
                return (
                  <tr key={c.id} className="hover:bg-blue-50/20">
                    <td className="px-2 py-4 border-r text-gray-400 font-mono text-center bg-gray-50/10">{c.id}</td>
                    {['name', 'email', 'role'].map((field) => (
                      <td key={field} className="p-0 border-r">
                        <EditableInput
                            id={c.id}
                            field={field}
                            defaultValue={c[field] || ''}
                            action={updateCoreData}
                            className="w-full bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none focus:bg-white px-1 py-0.5 rounded transition-all"
                         />
                      </td>
                    ))}
                    {allDynamicKeys.map(key => (
                      <td key={key} className="px-4 py-3">
                        <EditableInput
                          id={c.id}
                          metadataKey={key}
                          defaultValue={c.metadata?.[key] || ''}
                          action={updateMetadataCell}
                          className="w-full bg-transparent border-b border-transparent focus:border-amber-500 focus:outline-none text-indigo-600"
                        />
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
        {/* 分頁按鈕區塊 */}
<div className="flex justify-center items-center gap-2 mt-6 mb-10">
  {/* 第一頁 */}
  <a 
    href="/dashboard?page=1" 
    className={`px-3 py-1 border-2 border-slate-800 rounded font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-100 active:translate-y-0.5 ${currentPage === 1 ? 'bg-slate-200 pointer-events-none' : 'bg-white'}`}
  >
    FIRST
  </a>

  {/* 上一頁 */}
  <a 
    href={`/dashboard?page=${currentPage - 1}`} 
    className={`px-3 py-1 border-2 border-slate-800 rounded font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-100 ${currentPage <= 1 ? 'opacity-30 pointer-events-none' : 'bg-white'}`}
  >
    PREV
  </a>

  {/* 頁碼顯示 */}
  <div className="flex gap-1 px-4 py-1 bg-slate-800 text-white rounded font-mono text-xs">
    {currentPage} / {totalPages}
  </div>

  {/* 下一頁 */}
  <a 
    href={`/dashboard?page=${currentPage + 1}`} 
    className={`px-3 py-1 border-2 border-slate-800 rounded font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-100 ${currentPage >= totalPages ? 'opacity-30 pointer-events-none' : 'bg-white'}`}
  >
    NEXT
  </a>
  {/* <div className="flex gap-1">
      <a href={`/dashboard?page=${currentPage - 1}`} className={`px-2 py-1 border-2 border-slate-800 text-xs font-bold ${currentPage <= 1 ? 'opacity-30 pointer-events-none' : 'bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}>PREV</a>
      <span className="px-4 py-1 bg-slate-800 text-white text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">{currentPage} / {totalPages}</span>
      <a href={`/dashboard?page=${currentPage + 1}`} className={`px-2 py-1 border-2 border-slate-800 text-xs font-bold ${currentPage >= totalPages ? 'opacity-30 pointer-events-none' : 'bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}>NEXT</a>
  </div> */}

  {/* 最後一頁 */}
  <a 
    href={`/dashboard?page=${totalPages}`} 
    className={`px-3 py-1 border-2 border-slate-800 rounded font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-100 ${currentPage === totalPages ? 'bg-slate-200 pointer-events-none' : 'bg-white'}`}
  >
    LAST
  </a>
  {/* ✅ 新增的跳頁 */}
    <JumpToPage totalPages={totalPages} currentPage={currentPage} />
    
    <DeleteAllDataButton></DeleteAllDataButton>
</div>

{/* 3. FILTERED RESULTS (CUSTOMER) */}
<div className="mb-10 animate-in fade-in duration-500">
  <div className="bg-indigo-600 text-white p-2 rounded-t-lg flex justify-between items-center border-x-2 border-t-2 border-indigo-600">
    <h2 className="font-bold uppercase text-[9px] flex items-center gap-2">
      <span className="bg-white text-indigo-600 px-2 py-0.5 rounded-full">Results</span>
      Customer Table Search Match ({filteredTotalCount}) 
    </h2>
    <span className="text-xs font-bold">
        Page {currentFilteredPage} / {filteredTotalPages}
    </span>
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
   {/* 分頁控制區塊 */}
  <div className="flex justify-center items-center gap-2 mt-4">
      <a href={`/dashboard?filteredPage=${currentFilteredPage - 1}`} className="px-2 py-1 border rounded">Prev</a>
      <JumpToPage 
        totalPages={filteredTotalPages} 
        currentPage={currentFilteredPage} 
        paramName="filteredPage" 
      />
      <a href={`/dashboard?filteredPage=${currentFilteredPage + 1}`} className="px-2 py-1 border rounded">Next</a>
  </div>
</div>

  


        {/* 2. FILTER FOR customer_info TABLE */}
        <div className="bg-indigo-50 p-4 rounded border border-indigo-100 mb-4">
          <h2 className="text-[9px] font-bold text-indigo-900 uppercase mb-2">Table Filter (customer_info)</h2>
          <form action={handleSyncSearch} className="flex gap-2 max-w-2xl">
            {/* 關鍵：把目前的 params 轉成字串傳給後端 */}
            <input type="hidden" name="currentSearchParams" value={new URLSearchParams(params as any).toString()} />
            <input type="hidden" name="tenant" value="public" />
            <input name="syncId" placeholder="Filter Sync ID" className="border p-2 rounded flex-1 bg-white" defaultValue={syncId} />
            <input name="syncEmail" placeholder="Filter Sync Email" className="border p-2 rounded flex-1 bg-white" defaultValue={syncEmail} />
            <button type="submit" className="bg-indigo-900 text-white px-6 rounded font-bold uppercase">Table Search 🔍</button>
          </form>
        </div>
        {/* customer_info TABLE */}
        <h2 className="text-sm font-bold mb-3 text-indigo-900 uppercase">Customer_info Table</h2>
        <div className="bg-white shadow rounded border border-indigo-100 max-w-md overflow-hidden">
          <table className="min-w-full text-left">
            <thead className="bg-indigo-900 text-white uppercase text-[8px]">
              <tr>
                <th className="px-4 py-2 border-r border-indigo-800">ID</th>
                <th className="px-4 py-2">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allSyncRecords.map((c: any) => (
                <tr key={`sync-${c.id}`} className="hover:bg-indigo-50/30">
                  <td className="px-4 py-2 font-mono text-gray-400 border-r border-gray-100">{c.id}</td>
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
        {/* customer_info Results 分頁器 */}
            <div className="flex items-center gap-1 mb-1">
              <a href={createURL('syncPage', currentSyncPage - 1)} className={`px-2 py-0.5 border border-slate-800 text-[9px] font-bold ${currentSyncPage <= 1 ? 'opacity-30 pointer-events-none' : 'bg-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'}`}>PREV</a>
              <span className="text-[9px] font-bold px-2">{currentSyncPage} / {totalSyncPages}</span>
              <a href={createURL('syncPage', currentSyncPage + 1)} className={`px-2 py-0.5 border border-slate-800 text-[9px] font-bold ${currentSyncPage >= totalSyncPages ? 'opacity-30 pointer-events-none' : 'bg-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'}`}>NEXT</a>
              {/* ✅ 在 NEXT 右側加入 JumpToPage，並指定 paramName 為 'syncPage' */}
              <JumpToPage 
                totalPages={totalSyncPages} 
                currentPage={currentSyncPage} 
                paramName="syncPage" 
              />
            </div>
    
{/* 4. FILTERED RESULTS (SYNC) */}
<div className="mt-6 animate-in slide-in-from-top-2 duration-300 max-w-md">
  <span className="text-xs font-bold">
        Page {currentFilteredSyncPage} / {filteredSyncTotalPages}
  </span>
  <div className="bg-amber-500 text-white px-4 py-2 rounded-t font-bold uppercase text-[8px] flex justify-between">
    <span>Customer_info Table Search Results</span>
    <span>{filteredSyncRecords.length} Found</span>
  </div>
  <div className="bg-white shadow border-2 border-amber-500 rounded-b overflow-hidden">
    {filteredSyncRecords.length > 0 ? (
      <table className="min-w-full text-[9px]">
        <tbody className="divide-y divide-amber-100">
          {filteredSyncRecords.map((s: any) => (
            <tr key={`filtered-sync-${s.id}`} className="bg-amber-50/20">
              <td className="px-4 py-2 font-mono text-amber-700 border-r border-amber-100">{s.id}</td>
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
  {/* 分頁控制區塊 */}
  <div className="flex justify-center items-center gap-2 mt-4">
      <a href={`/dashboard?filteredSyncPage=${currentFilteredSyncPage - 1}`} className="px-2 py-1 border rounded">Prev</a>
      <JumpToPage 
        totalPages={filteredSyncTotalPages} 
        currentPage={currentFilteredSyncPage} 
        paramName="filteredSyncPage" 
      />
      <a href={`/dashboard?filteredSyncPage=${currentFilteredSyncPage + 1}`} className="px-2 py-1 border rounded">Next</a>
  </div>
</div>

      </div>
    </div>
  );
}