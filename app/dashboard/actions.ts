'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
 // --- SERVER ACTIONS ---

  export async function handleLogout() { redirect('/'); }

  export async function addCustomer(formData: FormData) {
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
    revalidatePath('/dashboard');
  }

  export async function updateCoreData(formData: FormData) {
    const id = Number(formData.get('id'));
    const field = formData.get('field') as string;
    const value = formData.get('value') as string;
    await prisma.customer.update({ where: { id }, data: { [field]: value } });
    revalidatePath('/dashboard');
  }

  export async function updateMetadataCell(formData: FormData) {
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

  revalidatePath('/dashboard');
}


  export async function addOrUpdateColumn(formData: FormData) {
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
    revalidatePath('/dashboard');
  }

  export async function deleteWholeColumn(formData: FormData) {
    const keyToDelete = formData.get('keyToDelete') as string;
    const allRecords = await prisma.customer.findMany();
    for (const r of allRecords) {
      const meta = (r.metadata as Record<string, any>) || {};
      delete meta[keyToDelete];
      await prisma.customer.update({ where: { id: r.id }, data: { metadata: meta } });
    }
    revalidatePath('/dashboard');
  }

  export async function updateSyncEmail(formData: FormData) {
    const infoId = Number(formData.get('infoId'));
    const newEmail = formData.get('newEmail') as string;
    if (!infoId) return;
    await prisma.customer_info.update({ where: { id: infoId }, data: { email: newEmail } });
    revalidatePath('/dashboard');
  }

  export async function deleteRow(formData: FormData) {
    await prisma.customer.delete({ where: { id: Number(formData.get('id')) } });
    revalidatePath('/dashboard');
  }

  export async function handleTableSearch(formData: FormData) {
    // 1. 取得目前完整的 URL 參數 (這需要從 formData 裡拿到目前的 searchParams 字串)
    const currentParamsStr = formData.get("currentSearchParams")?.toString() || "";
    const params = new URLSearchParams(currentParamsStr);
    
    // Only add fields that have an actual value
    formData.forEach((value, key) => {
      if (key === "currentSearchParams") return; // 跳過隱藏欄位本身
      if (value && value.toString().trim() !== "") {
        params.set(key, value.toString());
      }else{
        params.delete(key); // 如果清空輸入框，就移除該參數
      }
    });
    redirect(`/dashboard?${params.toString()}`);
  }

  export async function handleSyncSearch(formData: FormData) {
    // 1. 取得目前完整的 URL 參數 (這需要從 formData 裡拿到目前的 searchParams 字串)
    const currentParamsStr = formData.get("currentSearchParams")?.toString() || "";
    const params = new URLSearchParams(currentParamsStr);
    
    // Only add fields that have an actual value
    formData.forEach((value, key) => {
      if (key === "currentSearchParams") return; // 跳過隱藏欄位本身
      if (value && value.toString().trim() !== "") {
        params.set(key, value.toString());
      }else{
        params.delete(key); // 如果清空輸入框，就移除該參數
      }
    });
    redirect(`/dashboard?${params.toString()}`);
  }

  export async function clearFilters() {
    redirect('/dashboard');
  }