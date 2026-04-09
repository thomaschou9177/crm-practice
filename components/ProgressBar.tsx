"use client";

export default function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full bg-gray-200 rounded">
      <div
        className="bg-green-500 text-white text-xs font-bold text-center rounded"
        style={{ width: `${progress}%` }}
      >
        {Math.floor(progress)}%
      </div>
    </div>
  );
}
