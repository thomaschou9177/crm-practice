"use client";
import { useEffect, useState } from "react";

type ImportProgressProps = {
  fileId: string;   // ✅ 新增 fileId
  total: number;
};

export default function ImportProgress({ fileId, total }: ImportProgressProps) {
  const [progress, setProgress] = useState({ processed: 0, total, percentage: 0 });

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/progress?fileId=${fileId}&total=${total}`);
      const data = await res.json();
      setProgress(data);
    }, 2000);
    return () => clearInterval(interval);
  }, [fileId, total]);

  return (
    <div className="w-full bg-gray-200 rounded">
      <div
        className="bg-green-600 text-white text-xs font-bold p-1 rounded"
        style={{ width: `${progress.percentage}%` }}
      >
        {progress.processed} / {progress.total} ({progress.percentage}%)
      </div>
    </div>
  );
}
