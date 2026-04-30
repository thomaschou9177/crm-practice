// app/dashboard/actions.ts
'use server';
import { prisma } from '@/lib/db';
import { createSession, destroySession } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
 // --- SERVER ACTIONS ---

  export async function handleLogout(formData: FormData) {
  const tenant = formData.get('tenant')?.toString() || 'public';
  // const targetTenant = formData.get('target_tenant')?.toString();

  // 這裡「不需要」呼叫 API
  // 在 Server Action 中直接刪除 Cookie 是最快、最穩定的做法
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('sessionId')?.value;

  if (sessionId) {
    // 如果後端有 session store，在這裡銷毀它
    await destroySession(sessionId); 
  }

  cookieStore.delete('sessionId');

  // 導向首頁
  redirect(tenant === 'public' ? '/' : `/${tenant}`);
}

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
      if (key === "currentSearchParams" || key === "tenant") return; // 跳過隱藏欄位本身
      if (value && value.toString().trim() !== "") {
        params.set(key, value.toString());
      }else{
        params.delete(key); // 如果清空輸入框，就移除該參數
      }
    });
    // 取得隱藏欄位中的租戶資訊或從 cookie 判斷
    // 如果是 public，導向 /dashboard；否則導向 /tenant/dashboard
    // 這裡建議在 page.tsx 的 form 傳入一個 hidden tenant 欄位
    const tenant = formData.get("tenant")?.toString() || "public";
    const basePath = tenant === 'public' ? '/dashboard' : `/${tenant}/dashboard`;
    redirect(`${basePath}?${params.toString()}`);
  }

  export async function handleSyncSearch(formData: FormData) {
    // 1. 取得目前完整的 URL 參數 (這需要從 formData 裡拿到目前的 searchParams 字串)
    const currentParamsStr = formData.get("currentSearchParams")?.toString() || "";
    const params = new URLSearchParams(currentParamsStr);
    
    // Only add fields that have an actual value
    formData.forEach((value, key) => {
      if (key === "currentSearchParams" || key === "tenant") return; // 跳過隱藏欄位本身
      if (value && value.toString().trim() !== "") {
        params.set(key, value.toString());
      }else{
        params.delete(key); // 如果清空輸入框，就移除該參數
      }
    });
    // 取得隱藏欄位中的租戶資訊或從 cookie 判斷
    // 如果是 public，導向 /dashboard；否則導向 /tenant/dashboard
    // 這裡建議在 page.tsx 的 form 傳入一個 hidden tenant 欄位
    const tenant = formData.get("tenant")?.toString() || "public";
    const basePath = tenant === 'public' ? '/dashboard' : `/${tenant}/dashboard`;
    redirect(`${basePath}?${params.toString()}`);
  }

  export async function clearFilters() {
    redirect('/dashboard');
  }

  // 定義帳號清單
  const PUBLIC_USERS = [
    { username: "admin", password: "password123" },
    { username: "user", password: "user123" },
    { username: "test", password: "test123" },
  ];

  export async function loginPublic(prevState: any,formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  // ✅ 1. 執行三組帳號驗證
  const user = PUBLIC_USERS.find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    // ✅ 建立持久化的 Session 並取得 ID
    const sessionId = await createSession({
      tenant: 'public',
      isLoggedIn: true,
      user: { name: user.username }
    });
    // ✅ 2. 直接操作 Cookie，不要 fetch /api/login (避免 URL 解析錯誤)
    const cookieStore = await cookies();
    
    // 設定 Session Cookie (不給 maxAge，分頁關閉時瀏覽器會視情況清理)
    cookieStore.set('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    redirect('/dashboard');
  } else {
    // 驗證失敗
    // ✅ 失敗時不 redirect，直接回傳錯誤訊息給前端
    return { error: "帳號或密碼錯誤，請重新輸入。" };
  }

  // // ✅ 呼叫 /api/login，由 API 建立 session 並設定 sessionId cookie
  // const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/login`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     username,
  //     password,
  //     tenant: 'public', // 固定 public schema
  //   }),
  // });

  // if (res.ok) {
  //   // 登入成功 → 導向 public dashboard
  //   redirect('/dashboard');
  // } else {
  //   // 登入失敗 → 導回登入頁
  //   redirect('/');
  //   }
  }