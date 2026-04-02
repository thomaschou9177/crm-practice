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
    const key = formData.get('key') as string;
    const newValue = formData.get('newValue') as string;
    const record = await prisma.customer.findUnique({ where: { id } });
    const meta = (record?.metadata as Record<string, any>) || {};
    await prisma.customer.update({ where: { id }, data: { metadata: { ...meta, [key]: newValue } } });
    revalidatePath('/dashboard');
  }

  export async function addOrUpdateColumn(formData: FormData) {
    const id = Number(formData.get('id'));
    const colTitle = formData.get('colTitle') as string;
    const value = formData.get('value') as string;
    if (!colTitle) return;
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

  export async function handleSyncSearch(formData: FormData) {
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

  export async function clearFilters() {
    redirect('/dashboard');
  }