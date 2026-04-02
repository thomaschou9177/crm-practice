// components/JumpToPage.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function JumpToPage({ totalPages, currentPage,paramName = 'page' }: { totalPages: number, currentPage: number,paramName?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inputValue, setInputValue] = useState(currentPage.toString());

  // 當外部頁碼改變時（例如點擊 PREV/NEXT），同步輸入框內容
  useEffect(() => {
    setInputValue(currentPage.toString());
  }, [currentPage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      let page = parseInt(inputValue);
      
      // 確保輸入值在有效範圍內
      if (isNaN(page) || page < 1) page = 1;
      if (page > totalPages) page = totalPages;

      const params = new URLSearchParams(searchParams.toString());
      params.set(paramName, page.toString()); // 使用指定參數名稱
      router.push(`/dashboard?${params.toString()}`);
    }
  };

  return (
    <div className="flex items-center gap-2 ml-4">
      <span className="text-[10px] font-bold text-slate-500 uppercase">Go to:</span>
      <div className="relative flex items-center">
        <input 
          type="number"
          min={1}
          max={totalPages}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-16 text-xs border-2 border-slate-800 rounded px-2 py-0.5 bg-white font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-indigo-50 transition-colors"
        />
        <span className="ml-2 text-[10px] text-slate-400 font-bold">/ {totalPages}</span>
      </div>
    </div>
  );
}