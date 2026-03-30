'use client';

export function DeleteRowButton() {
  return (
    <button 
      type="submit" 
      onClick={(e) => {
        if (!confirm("Are you sure you want to delete this customer?")) {
          e.preventDefault();
        }
      }}
      className="text-red-500 font-bold hover:underline"
    >
      Delete
    </button>
  );
}