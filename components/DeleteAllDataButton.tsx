// src/components/DeleteAllDataButton.tsx
"use client";
import { useParams } from "next/navigation";
export default function DeleteAllDataButton() {
  const params = useParams();
  const tenant = (params?.tenant as string) || "public"; // 如果沒有 tenant 參數則預設為 public
  return (
    <form action="/api/deleteAll" method="post">
      {/* 新增一個隱藏欄位來傳遞目前的 tenant */}
      <input type="hidden" name="tenant" value={tenant} />
      <button
        type="submit"
        className="bg-red-600 text-white px-6 py-2 rounded font-bold"
        onClick={(e) => {
          if (!confirm(`⚠️ 確定要刪除 [${tenant}] 的所有資料嗎？此操作不可回復！`)) {
            e.preventDefault();
          }
        }}
      >
        Delete All Data ({tenant})
      </button>
    </form>
  );
}
