'use client'; // Required for browser interactivity

export function DeleteColumnButton({ columnName }: { columnName: string }) {
  return (
    <button 
      type="submit"
      onClick={(e) => {
        // Confirmation dialog works here because this is a Client Component
        if (!confirm(`Are you sure you want to delete the "${columnName}" column?`)) {
          e.preventDefault();
        }
      }}
      className="text-red-400 hover:text-red-200 font-bold text-[12px] leading-none transition-colors"
      title="Delete Column"
    >
      ✕
    </button>
  );
}