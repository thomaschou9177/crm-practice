// app/[tenant]/dashboard/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = false;

import DeleteAllDataButton from '@/components/DeleteAllDataButton';
import { DeleteColumnButton } from '@/components/DeleteColumnButton';
import { DeleteRowButton } from '@/components/DeleteRowButton';
import EditableInput from '@/components/EditableInput';
import ImportBar from '@/components/ImportBar';
import JumpToPage from '@/components/JumpToPage';
import LogoutButton from '@/components/LogoutButton';
import TenantGuard from '@/components/TenantGuard';
import { getPrismaClient } from '@/lib/db';
import { addCustomer, addOrUpdateColumn, clearFilters, deleteRow, deleteWholeColumn, handleSyncSearch, handleTableSearch, updateCoreData, updateMetadataCell, updateSyncEmail } from './actions';

export default async function DashboardPage(props: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenant } = await props.params;
  const params: Record<string, string | undefined> = await props.searchParams;
  const prisma = getPrismaClient(tenant);

  // ---------------------------------------------------------
  // 綁定 Actions
  // ---------------------------------------------------------
  const updateCoreDataWithTenant = updateCoreData.bind(null, tenant);
  const addCustomerWithTenant = addCustomer.bind(null, tenant);
  const addOrUpdateColumnWithTenant = addOrUpdateColumn.bind(null, tenant);
  const clearFiltersWithTenant = clearFilters.bind(null, tenant);
  const deleteRowWithTenant = deleteRow.bind(null, tenant);
  const deleteWholeColumnWithTenant = deleteWholeColumn.bind(null, tenant);
  const updateMetadataCellWithTenant = updateMetadataCell.bind(null, tenant);
  const updateSyncEmailWithTenant = updateSyncEmail.bind(null, tenant);

  // --- 分頁參數計算 ---
  const pageSize = 50;
  const currentPage = Number(params.page) || 1;
  const skip = (currentPage - 1) * pageSize;

  const syncPageSize = 50;
  const currentSyncPage = Number(params.syncPage) || 1;
  const syncSkip = (currentSyncPage - 1) * syncPageSize;

  const { id, name, email, role, syncId, syncEmail } = params;

  // --- FETCH ALL DATA ---
  const allCustomers = await prisma.customer.findMany({
    include: { customer_info: true },
    orderBy: { id: 'asc' },
    skip: skip,
    take: pageSize
  });

  const totalCount = await prisma.customer.count();
  const totalPages = Math.ceil(totalCount / pageSize);

  const totalSyncCount = await prisma.customer_info.count();
  const totalSyncPages = Math.ceil(totalSyncCount / syncPageSize);

  const allSyncRecords = await prisma.customer_info.findMany({
    orderBy: { id: 'asc' },
    skip: syncSkip,
    take: syncPageSize,
  });

  // 🟢 1. 完全保留您原本的動態解析與過濾邏輯，先拿到一個基礎陣列
  const rawDynamicKeys: string[] = Array.from(
    new Set(
      allCustomers.flatMap((c: any) => {
        const meta = (c.metadata as Record<string, any>) || {};
        return Object.keys(meta).map(k => k.toLowerCase());
      })
    )
  ).filter((key) => key !== 'customer_info' && key !== 'metadata');

  // 🟢 2. 【最簡單的動態防錯位排序】：
  // 我們檢查第一筆客戶身上一開始就存在的欄位。只要是全體資料中有、但第一筆資料中沒有的欄位，代表它是後來新誕生的！
  const firstCustomerMeta = (allCustomers[0]?.metadata as Record<string, any>) || {};
  const initialKeys = Object.keys(firstCustomerMeta).map(k => k.toLowerCase());

  const allDynamicKeys = [...rawDynamicKeys].sort((a, b) => {
    const hasA = initialKeys.includes(a);
    const hasB = initialKeys.includes(b);

    if (hasA && !hasB) return -1; // 舊欄位排前面
    if (!hasA && hasB) return 1;  // 新欄位（如 hobby）往後推
    return 0;                     // 其他維持原樣
  });
  // 判斷是否有啟用過濾
  const isCustomerFiltering = Object.entries({
    id, name, email, role,
    ...Object.fromEntries(allDynamicKeys.map((k: string) => [k, params[k]]))
  } as Record<string, string | undefined>).some(([_, v]) => v && v.trim() !== "");

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

  // 動態屬性過濾過查
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

  const filteredCustomers = isCustomerFiltering
    ? await prisma.customer.findMany({
        where: customerWhere,
        include: { customer_info: true },
        orderBy: { id: 'asc' },
        skip: filteredSkip,
        take: filteredPageSize,
      })
    : [];

  const filteredTotalCount = isCustomerFiltering ? await prisma.customer.count({ where: customerWhere }) : 0;
  const filteredTotalPages = Math.ceil(filteredTotalCount / filteredPageSize);

  const filteredSyncPageSize = 50;
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

  const filteredSyncTotalCount = isSyncFiltering ? await prisma.customer_info.count({ where: syncWhere }) : 0;
  const filteredSyncTotalPages = Math.ceil(filteredSyncTotalCount / filteredSyncPageSize);

  const createURL = (name: string, value: string | number) => {
    const newParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (typeof v === "string") {
        newParams.set(k, v);
      }
    });
    newParams.set(name, value.toString());
    return `/${tenant}/dashboard?${newParams.toString()}`;
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen text-black text-[10px]">
      <div className="max-w-[98%] mx-auto">
        <TenantGuard currentTenant={tenant} />
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-tighter">Excel-Style CRM</h1>
          <LogoutButton tenant={tenant} />
        </div>

        {/* IMPORT BAR */}
        <ImportBar />

        {/* 1. FILTER FOR CUSTOMER TABLE */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-indigo-600 uppercase text-[9px]">Table Filter (Customer Data)</h2>
            <form action={clearFiltersWithTenant}>
              <button className="text-gray-400 hover:text-red-500 underline text-[8px]">Clear Table Filters</button>
            </form>
          </div>
          <form action={handleTableSearch} className="grid grid-cols-8 gap-2">
            <input type="hidden" name="tenant" value={tenant} />
            <input type="hidden" name="currentSearchParams" value={new URLSearchParams(params as any).toString()} />
            <input name="id" placeholder="ID" className="border p-2 rounded outline-none text-[11px]" defaultValue={id} />
            <input name="name" placeholder="Name" className="border p-2 rounded outline-none text-[11px]" defaultValue={name} />
            <input name="email" placeholder="Email" className="border p-2 rounded outline-none text-[11px]" defaultValue={email} />
            <input name="role" placeholder="Role" className="border p-2 rounded outline-none text-[11px]" defaultValue={role} />
            
            {/* 🟢 自動生成的客製化屬性搜尋欄 */}
            {allDynamicKeys.map((key) => (
              <input
                key={key}
                name={key}
                placeholder={`Meta: ${key}`}
                className="border p-2 rounded bg-blue-50 outline-none text-[11px]"
                defaultValue={params[key]}
              />
            ))}
            <button type="submit" className="bg-indigo-600 text-white rounded font-bold uppercase text-[11px] hover:bg-indigo-700 transition">Table Search 🔍</button>
          </form>
        </div>

        {/* ADD ROW BAR */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="font-bold mb-3 text-blue-600 uppercase text-[9px]">Add New Customer</h2>
          <form action={addCustomerWithTenant} className="flex gap-2">
            <input name="id" placeholder="id" className="border p-2 rounded flex-1 outline-none text-[11px]" required />
            <input name="name" placeholder="Name" className="border p-2 rounded flex-1 outline-none text-[11px]" required />
            <input name="email" placeholder="Email" className="border p-2 rounded flex-1 outline-none text-[11px]" required />
            <input name="role" placeholder="Role" className="border p-2 rounded flex-1 outline-none text-[11px]" required />
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-bold text-[11px] hover:bg-blue-700 transition">+ Create</button>
          </form>
        </div>

        {/* 3. FILTERED RESULTS (CUSTOMER) */}
        {isCustomerFiltering && (
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
                <table className="min-w-full border-collapse border border-gray-300">
                  <thead className="bg-indigo-50 text-indigo-900 uppercase text-[9px]">
                    <tr className="divide-x divide-gray-300">
                      <th className="px-3 py-2 border border-gray-300 w-12 text-center font-bold">ID</th>
                      <th className="px-4 py-2 border border-gray-300 text-left min-w-[120px]">Name</th>
                      <th className="px-4 py-2 border border-gray-300 text-left min-w-[180px]">Email</th>
                      <th className="px-4 py-2 border border-gray-300 text-left min-w-[120px]">Role</th>
                      {/* 🟢 搜尋結果同步攤平動態屬性欄位 */}
                      {allDynamicKeys.map((key) => (
                        <th key={key} className="px-4 py-2 border border-gray-300 text-left min-w-[130px] font-mono font-bold bg-indigo-100/50">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300">
                    {filteredCustomers.map((c: any) => {
                      const meta = (c.metadata as Record<string, any>) || {};
                      return (
                        <tr key={`filtered-cust-${c.id}`} className="hover:bg-indigo-50/50 transition-colors divide-x divide-gray-300">
                          <td className="px-3 py-2 border border-gray-300 text-center font-mono text-gray-400 bg-gray-50/20">{c.id}</td>
                          <td className="px-4 py-2 border border-gray-300 font-medium">{c.name}</td>
                          <td className="px-4 py-2 border border-gray-300 text-indigo-700">{c.email}</td>
                          <td className="px-4 py-2 border border-gray-300 text-gray-600">{c.role}</td>
                          
                          {/* 🟢 安全渲染展平後的客製化值 */}
                          {allDynamicKeys.map((key) => {
                            let rawValue = meta[key];
                            if (rawValue && typeof rawValue === 'object') {
                              rawValue = rawValue[key] !== undefined ? String(rawValue[key]) : JSON.stringify(rawValue);
                            } else {
                              rawValue = String(rawValue ?? "");
                            }
                            return (
                              <td key={key} className="px-4 py-2 border border-gray-300 text-blue-700 font-medium bg-amber-50/10">
                                {rawValue}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-10 text-center bg-white border-2 border-dashed border-indigo-200 text-gray-400">
                  The filter is active, but Prisma found 0 matches in the database.
                </div>
              )}
            </div>
            <div className="flex justify-center items-center gap-2 mt-4">
                <a href={`/${tenant}/dashboard?filteredPage=${currentFilteredPage - 1}`} className="px-2 py-1 border rounded bg-white hover:bg-gray-100 transition">Prev</a>
                <JumpToPage totalPages={filteredTotalPages} currentPage={currentFilteredPage} paramName="filteredPage" />
                <a href={`/${tenant}/dashboard?filteredPage=${currentFilteredPage + 1}`} className="px-2 py-1 border rounded bg-white hover:bg-gray-100 transition">Next</a>
            </div>
          </div>
        )}     

        <div className="flex justify-between items-end mb-2">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-tight">
            Customer Table 
            <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
              Total: {totalCount} records
            </span>
          </h2>
          <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500">
            <span>PAGE {currentPage} / {totalPages}</span>
          </div>
        </div>

        {/* 🟢 MAIN TABLE (真正落實全 Excel 直線隔開、動態寬度彈性、完全移除獨立大 METADATA 欄位) */}
        <div className="bg-white shadow-xl rounded-lg overflow-x-auto border border-gray-300 mb-10">
          <table className="min-w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-800 text-white uppercase tracking-wider text-[10px] divide-x divide-gray-700">
                <th className="px-3 py-3 border border-gray-700 w-14 text-center font-bold">ID</th>
                <th className="px-4 py-3 border border-gray-700 text-left min-w-[120px] max-w-[200px]">Name</th>
                <th className="px-4 py-3 border border-gray-700 text-left min-w-[180px] max-w-[280px]">Email</th>
                <th className="px-4 py-3 border border-gray-700 text-left min-w-[120px] max-w-[180px]">Role</th>
                
                {/* 1. 將包含 Excel 匯入及 Add Column 產生的所有客製屬性依序展開 */}
                {allDynamicKeys.map((key) => (
                  <th key={key} className="px-4 py-3 border border-gray-700 bg-gray-700 text-left min-w-[130px] max-w-[220px] font-mono font-bold">
                    <div className="flex justify-between items-center gap-2">
                      <span className="truncate">{key}</span>
                      <form action={deleteWholeColumnWithTenant}>
                        <input type="hidden" name="keyToDelete" value={key} />
                        <DeleteColumnButton columnName={key} />
                      </form>
                    </div>
                  </th>
                ))}
                
                {/* 2. 【位置後移】：Add Column 放在所有客製化屬性的最右邊 */}
                <th className="px-4 py-3 border border-gray-700 bg-blue-900 min-w-[200px] text-left uppercase text-white font-bold">Add Column</th>
                <th className="px-4 py-3 border border-gray-700 text-right w-20 font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {allCustomers.map((c: any) => {
                return (
                  <tr key={c.id} className="hover:bg-blue-50/20 transition-colors divide-x divide-gray-300">
                    <td className="px-3 py-4 border border-gray-300 text-gray-400 font-mono text-center bg-gray-50/30">{c.id}</td>
                    {['name', 'email', 'role'].map((field) => (
                      <td key={field} className="p-0 border border-gray-300">
                        <EditableInput
                          id={c.id}
                          field={field}
                          defaultValue={c[field] || ''}
                          tenant={tenant}
                          className="w-full px-3 py-3.5 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-[11px]"
                        />
                      </td>
                    ))}

                    {/* 3. 從各個客製屬性對應抓出 metadata 中的數值，絕不顯示原始大 JSONB 物件 */}
                    {allDynamicKeys.map(key => {
                      let rawValue = c[key] !== undefined ? c[key] : (c.metadata?.[key] || '');
                      if (rawValue && typeof rawValue === 'object') {
                        rawValue = rawValue[key] !== undefined ? String(rawValue[key]) : JSON.stringify(rawValue);
                      } else {
                        rawValue = String(rawValue ?? '');
                      }

                      return (
                        <td key={key} className="p-0 border border-gray-300 bg-amber-50/5">
                          <EditableInput
                            id={c.id}
                            metadataKey={key}
                            defaultValue={rawValue}
                            tenant={tenant}
                            className="w-full px-3 py-3.5 bg-transparent border-b border-transparent focus:border-amber-500 text-indigo-600 font-mono text-[11px] outline-none"
                          />
                        </td>
                      );
                    })}

                    {/* 4. 同步右推的一列內 Add Column 操作格子 */}
                    <td className="p-2 border border-gray-300 bg-blue-50/30">
                      <form action={addOrUpdateColumnWithTenant} className="flex flex-col gap-1">
                        <input type="hidden" name="id" value={c.id} />
                        <input name="colTitle" placeholder="Col Title" className="border border-blue-200 p-1 rounded bg-white text-[9px] outline-none shadow-sm font-sans" />
                        <div className="flex gap-1">
                          <input name="value" placeholder="Value" className="border border-blue-200 p-1 rounded bg-white flex-1 text-[9px] outline-none shadow-sm font-sans" />
                          <button type="submit" className="bg-blue-600 text-white px-2 py-1 rounded font-bold text-[9px] hover:bg-blue-700 transition">Save</button>
                        </div>
                      </form>
                    </td>

                    <td className="px-4 py-4 border border-gray-300 text-right bg-gray-50/10">
                      <form action={deleteRowWithTenant}>
                        <input type="hidden" name="id" value={c.id} />
                        <DeleteRowButton />
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 主表格分頁按鈕區塊 */}
        <div className="flex justify-center items-center gap-2 mt-6 mb-10">
          <a href={`/${tenant}/dashboard?page=1`} className={`px-3 py-1 border-2 border-slate-800 rounded font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-100 active:translate-y-0.5 ${currentPage === 1 ? 'bg-slate-200 pointer-events-none' : 'bg-white'}`}>FIRST</a>
          <a href={`/${tenant}/dashboard?page=${currentPage - 1}`} className={`px-3 py-1 border-2 border-slate-800 rounded font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-100 ${currentPage <= 1 ? 'opacity-30 pointer-events-none' : 'bg-white'}`}>PREV</a>
          <div className="flex gap-1 px-4 py-1 bg-slate-800 text-white rounded font-mono text-xs">{currentPage} / {totalPages}</div>
          <a href={`/${tenant}/dashboard?page=${currentPage + 1}`} className={`px-3 py-1 border-2 border-slate-800 rounded font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-100 ${currentPage >= totalPages ? 'opacity-30 pointer-events-none' : 'bg-white'}`}>NEXT</a>
          <a href={`/${tenant}/dashboard?page=${totalPages}`} className={`px-3 py-1 border-2 border-slate-800 rounded font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-100 ${currentPage === totalPages ? 'bg-slate-200 pointer-events-none' : 'bg-white'}`}>LAST</a>
          <JumpToPage totalPages={totalPages} currentPage={currentPage} />
          <DeleteAllDataButton />
        </div>

        {/* 2. FILTER FOR customer_info TABLE */}
        <div className="bg-indigo-50 p-4 rounded border border-indigo-100 mb-4">
          <h2 className="text-[9px] font-bold text-indigo-900 uppercase mb-2">Table Filter (customer_info)</h2>
          <form action={handleSyncSearch} className="flex gap-2 max-w-2xl">
            <input type="hidden" name="tenant" value={tenant} />
            <input type="hidden" name="currentSearchParams" value={new URLSearchParams(params as any).toString()} />
            <input name="syncId" placeholder="Filter Sync ID" className="border p-2 rounded flex-1 bg-white outline-none text-[11px]" defaultValue={syncId} />
            <input name="syncEmail" placeholder="Filter Sync Email" className="border p-2 rounded flex-1 bg-white outline-none text-[11px]" defaultValue={syncEmail} />
            <button type="submit" className="bg-indigo-900 text-white px-6 rounded font-bold uppercase text-[11px] hover:bg-indigo-950 transition">Table Search 🔍</button>
          </form>
        </div>

        {/* customer_info TABLE */}
        <h2 className="text-sm font-bold mb-3 text-indigo-900 uppercase">Customer_info Table</h2>
        <div className="bg-white shadow rounded border border-indigo-100 max-w-md overflow-hidden mb-2">
          <table className="min-w-full text-left border-collapse border border-indigo-100">
            <thead className="bg-indigo-900 text-white uppercase text-[8px]">
              <tr className="divide-x divide-indigo-800">
                <th className="px-4 py-2 border border-indigo-800">ID</th>
                <th className="px-4 py-2 border border-indigo-800">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allSyncRecords.map((c: any) => (
                <tr key={`sync-${c.id}`} className="hover:bg-indigo-50/30 divide-x divide-gray-100">
                  <td className="px-4 py-2 font-mono text-gray-400 border border-gray-100 bg-gray-50/30">{c.id}</td>
                  <td className="p-0 border border-gray-100">
                    <form action={updateSyncEmailWithTenant} className="flex h-full items-center group">
                      <input type="hidden" name="infoId" value={c.id} />
                      <input 
                        name="newEmail" 
                        defaultValue={c.email || ""} 
                        className="w-full px-4 py-2 bg-transparent outline-none focus:bg-white text-indigo-700 font-medium text-[11px]" 
                      />
                      <button className="hidden group-focus-within:block px-2 text-[8px] text-indigo-400 font-bold hover:text-indigo-600">Sync</button>
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
          <JumpToPage totalPages={totalSyncPages} currentPage={currentSyncPage} paramName="syncPage" />
        </div>
    
        {/* 4. FILTERED RESULTS (SYNC) */}
        <div className="mt-6 animate-in slide-in-from-top-2 duration-300 max-w-md">
          <span className="text-xs font-bold block mb-1">
                Page {currentFilteredSyncPage} / {filteredSyncTotalPages}
          </span>
          <div className="bg-amber-500 text-white px-4 py-2 rounded-t font-bold uppercase text-[8px] flex justify-between">
            <span>Customer_info Table Search Results</span>
            <span>{filteredSyncRecords.length} Found</span>
          </div>
          <div className="bg-white shadow border-2 border-amber-500 rounded-b overflow-hidden">
            {filteredSyncRecords.length > 0 ? (
              <table className="min-w-full text-[9px] border-collapse">
                <tbody className="divide-y divide-amber-100">
                  {filteredSyncRecords.map((s: any) => (
                    <tr key={`filtered-sync-${s.id}`} className="bg-amber-50/20 divide-x divide-amber-100">
                      <td className="px-4 py-2 font-mono text-amber-700 border border-amber-100 w-16 text-center">{s.id}</td>
                      <td className="px-4 py-2 italic text-gray-700 border border-amber-100">
                        {s.email && typeof s.email === 'object' 
                          ? (s.email.email !== undefined ? String(s.email.email) : JSON.stringify(s.email))
                          : String(s.email || '')}
                      </td>
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
          <div className="flex justify-center items-center gap-2 mt-4">
              <a href={`/${tenant}/dashboard?filteredSyncPage=${currentFilteredSyncPage - 1}`} className="px-2 py-1 border rounded bg-white hover:bg-gray-100 transition">Prev</a>
              <JumpToPage totalPages={filteredSyncTotalPages} currentPage={currentFilteredSyncPage} paramName="filteredSyncPage" />
              <a href={`/${tenant}/dashboard?filteredSyncPage=${currentFilteredSyncPage + 1}`} className="px-2 py-1 border rounded bg-white hover:bg-gray-100 transition">Next</a>
          </div>
        </div>

      </div>
    </div>
  );
}