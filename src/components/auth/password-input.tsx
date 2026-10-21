"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({
  id,
  name,
  placeholder = "••••••••",
  autoComplete,
  disabled,
  className,
  defaultValue,
  value,
  onChange,
  required = true,
  describedBy,
  invalid,
}: {
  id?: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  describedBy?: string;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        spellCheck={false}
        className={cn("pr-11", className)}
        required={required}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-[#8A9A90] hover:bg-[#F3F9F5] hover:text-[#0B3D2E]"
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
