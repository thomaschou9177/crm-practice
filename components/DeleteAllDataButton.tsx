"use client";

export default function DeleteAllDataButton() {
  return (
    <form action="/api/deleteAll" method="post">
      <button
        type="submit"
        className="bg-red-600 text-white px-6 py-2 rounded font-bold"
        onClick={() =>
          confirm("⚠️ 確定要刪除所有資料嗎？此操作不可回復！")
        }
      >
        Delete All Data
      </button>
    </form>
  );
}
