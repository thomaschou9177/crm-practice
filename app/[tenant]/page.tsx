// app/[tenant]/page.tsx (Server Component)
import TenantLoginForm from "./TenantLoginForm";

// 這裡改成 async 函式
export default async function TenantPage({ 
  params 
}: { 
  params: Promise<{ tenant: string }> // 定義為 Promise
}) {
  // 使用 await 取得 tenant
  const { tenant } = await params; 
  
  return <TenantLoginForm tenant={tenant} />;
}