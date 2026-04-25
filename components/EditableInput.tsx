// components/EditableInput.tsx
'use client';

import { updateCoreData, updateMetadataCell } from '@/app/[tenant]/dashboard/actions';
import { useTransition } from 'react';

interface EditableInputProps {
  id: number;
  field?: string;        // 用於 core data
  metadataKey?: string;  // 用於 metadata
  defaultValue: string;
  tenant: string;        // 傳入目前的 tenant
  className?: string;
}

export default function EditableInput({
  id,
  field,
  metadataKey,
  defaultValue,
  tenant,
  className,
}: EditableInputProps) {
  const [isPending, startTransition] = useTransition();

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue !== defaultValue) {
      const formData = new FormData();
      formData.set('id', id.toString());

      if (field) {
        formData.set('field', field);
        formData.set('value', newValue);
        startTransition(() => {
          updateCoreData(tenant, formData);
        });
      } else if (metadataKey) {
        formData.set('key', metadataKey);
        formData.set('newValue', newValue);
        startTransition(() => {
          updateMetadataCell(tenant, formData);
        });
      }
    }
  };

  return (
    <input
      defaultValue={defaultValue}
      onBlur={handleBlur}
      className={className}
      disabled={isPending}
    />
  );
}
