// components/EditableInput.tsx
'use client'; // 關鍵：宣告這是用戶端組件

interface EditableInputProps {
  id: number;
  field?: string;      // 用於 core data
  metadataKey?: string; // 用於 metadata
  defaultValue: string;
  action: (formData: FormData) => Promise<void>;
  className?: string;
}

export default function EditableInput({ 
  id, 
  field, 
  metadataKey, 
  defaultValue, 
  action,
  className 
}: EditableInputProps) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {field && <input type="hidden" name="field" value={field} />}
      {metadataKey && <input type="hidden" name="key" value={metadataKey} />}
      
      <input
        name={field ? "value" : "newValue"}
        defaultValue={defaultValue}
        onBlur={(e) => {
          if (e.target.value !== e.target.defaultValue) {
            e.target.form?.requestSubmit();
          }
        }}
        className={className}
      />
    </form>
  );
}