// app/[tenant]/page.tsx (Server Component)
import TenantLoginForm from "./TenantLoginForm";

export default function TenantPage({ params }: { params: { tenant: string } }) {
  const tenant = params.tenant; // 這裡一定有值
  console.log(tenant);
  return <TenantLoginForm tenant={tenant} />;
}
