// app/[tenant]/dashboard/actions.ts
'use server';

import { getPrismaClient } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
 // --- SERVER ACTIONS ---

  export async function handleLogout(tenant:string) { 
    // 伺服器端清除 Cookie 的方式
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    cookieStore.delete('auth_tenant');
    cookieStore.delete('isLoggedIn');
    redirect(`/${tenant}`); 
  }

  export async function addCustomer(tenant:string,formData: FormData) {
    const prisma = getPrismaClient(tenant);
    const id = Number(formData.get('id')); // 從表單或 Excel 取得
    const email = formData.get('email') as string;
    await prisma.customer.create({
      data: {
        id,
        name: formData.get('name') as string,
        email, 
        role: formData.get('role') as string,
        customer_info: { create: { email } }
      }
    });
    revalidatePath(`/${tenant}/dashboard`);
  }

  export async function updateCoreData(tenant:string,formData: FormData) {
    const prisma = getPrismaClient(tenant); // 根據傳入的 tenant 取得連線
    const id = Number(formData.get('id'));
    const field = formData.get('field') as string;
    const value = formData.get('value') as string;
    await prisma.customer.update({ where: { id }, data: { [field]: value } });
    revalidatePath(`/${tenant}/dashboard`);
  }

  export async function updateMetadataCell(tenant:string,formData: FormData) {
  const prisma = getPrismaClient(tenant); // 根據傳入的 tenant 取得連線
  const id = Number(formData.get('id'));
  let key = formData.get('key') as string;
  let newValue: any = formData.get('newValue');

  if (!key) return;

  // ✅ 統一 key → 小寫
  key = key.toLowerCase();

  // ✅ 嘗試轉成數字，確保型別一致
  const numVal = Number(newValue);
  if (!isNaN(numVal) && newValue?.toString().trim() === numVal.toString()) {
    newValue = numVal; // 存成數字
  } else {
    newValue = String(newValue); // 存成字串
  }

  const record = await prisma.customer.findUnique({ where: { id } });
  const meta = (record?.metadata as Record<string, any>) || {};

  await prisma.customer.update({
    where: { id },
    data: { metadata: { ...meta, [key]: newValue } },
  });

  revalidatePath(`/${tenant}/dashboard`);
}


  export async function addOrUpdateColumn(tenant:string,formData: FormData) {
    const prisma = getPrismaClient(tenant); // 根據傳入的 tenant 取得連線
    const id = Number(formData.get('id'));
    let colTitle = formData.get('colTitle') as string;
    let value:any = formData.get('value');
    if (!colTitle) return;
    // ✅ 統一 key → 小寫
    colTitle = colTitle.toLowerCase();
    // ✅ 嘗試轉成數字，確保型別一致
  const numVal = Number(value);
  if (!isNaN(numVal) && value?.toString().trim() === numVal.toString()) {
    value = numVal; // 存成數字
  } else {
    value = String(value); // 存成字串
  }
    const record = await prisma.customer.findUnique({ where: { id } });
    const meta = (record?.metadata as Record<string, any>) || {};
    await prisma.customer.update({ where: { id }, data: { metadata: { ...meta, [colTitle]: value } } });
    revalidatePath(`/${tenant}/dashboard`);
  }

  export async function deleteWholeColumn(tenant:string,formData: FormData) {
    const prisma = getPrismaClient(tenant); // 根據傳入的 tenant 取得連線
    const keyToDelete = formData.get('keyToDelete') as string;
    const allRecords = await prisma.customer.findMany();
    for (const r of allRecords) {
      const meta = (r.metadata as Record<string, any>) || {};
      delete meta[keyToDelete];
      await prisma.customer.update({ where: { id: r.id }, data: { metadata: meta } });
    }
    revalidatePath(`/${tenant}/dashboard`);
  }

  export async function updateSyncEmail(tenant:string,formData: FormData) {
    const prisma = getPrismaClient(tenant); // 根據傳入的 tenant 取得連線
    const infoId = Number(formData.get('infoId'));
    const newEmail = formData.get('newEmail') as string;
    if (!infoId) return;
    await prisma.customer_info.update({ where: { id: infoId }, data: { email: newEmail } });
    revalidatePath(`/${tenant}/dashboard`);
  }

  export async function deleteRow(tenant:string,formData: FormData) {
    const prisma = getPrismaClient(tenant); // 根據傳入的 tenant 取得連線
    const id = Number(formData.get('id'));
    if (!id) return;

    try {
      // 1. 先刪除子表 (customer_info) 中參考此 id 的資料
      // 因為你的 customer_info PK 通常也是 id，且參考 customer.id
      await prisma.customer_info.deleteMany({
        where: { id: id }
      });

      // 2. 再刪除主表 (customer)
      await prisma.customer.delete({
        where: { id: id }
      });

      // 重新驗證路徑以更新 UI
      revalidatePath(`/${tenant}/dashboard`);
    } catch (error) {
      console.error("Delete failed:", error);
      // 可以在這裡處理錯誤，例如回傳錯誤訊息給前端
    }
  }

  export async function handleTableSearch(tenant:string,formData: FormData) {
    // 1. 取得目前完整的 URL 參數 (這需要從 formData 裡拿到目前的 searchParams 字串)
    const currentParamsStr = formData.get("currentSearchParams")?.toString() || "";
    // Create a fresh params object to ensure a clean URL
    const params = new URLSearchParams(currentParamsStr);
    // 2. 更新或設定 Customer 相關的過濾條件
    formData.forEach((value, key) => {
      if (key === "currentSearchParams") return; // 跳過隱藏欄位本身
      if (value && value.toString().trim() !== "") {
        params.set(key, value.toString());
      }else{
        params.delete(key); // 如果清空輸入框，就移除該參數
      }
    });
    redirect(`/${tenant}/dashboard?${params.toString()}`);
  }

  export async function handleSyncSearch(tenant:string,formData: FormData) {
    // 1. 這裡也要改成讀取 currentSearchParams，否則會清空 customer 表格的搜尋結果
    const currentParamsStr = formData.get("currentSearchParams")?.toString() || "";
    const params = new URLSearchParams(currentParamsStr);
    
    
    formData.forEach((value, key) => {
      if (key === "currentSearchParams") return;
      if (value && value.toString().trim() !== "") {
        params.set(key, value.toString());
      }else {
      params.delete(key);
      }
    });
    redirect(`/${tenant}/dashboard?${params.toString()}`);
  }

  export async function clearFilters(tenant:string) {
    redirect(`/${tenant}/dashboard`);
  }