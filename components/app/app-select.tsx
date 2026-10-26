"use client";

import { useEffect, useRef, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type AppSelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

// The dropdown cannot hold "" as an option's value, but forms use "" for
// "any" (All statuses, No coordinator), so it stands in for it.
const EMPTY = "__empty__";
const toItem = (value: string) => (value === "" ? EMPTY : value);
const fromItem = (value: string) => (value === EMPTY ? "" : value);

/**
 * Calls `onReset` when the form holding `input` is reset, so a field the
 * browser does not manage itself goes back to how the page opened it.
 */
export function useFormReset(
  input: React.RefObject<HTMLInputElement | null>,
  onReset: () => void,
) {
  const latest = useRef(onReset);
  useEffect(() => {
    latest.current = onReset;
  });
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const reset = () => latest.current();
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [input]);
}

/**
 * The app's one dropdown (SCRUM shared page conventions): the same trigger
 * and list wherever a choice is made. Controlled with `value`, or left to
 * itself with `defaultValue`; with a `name` it is sent with its form like a
 * native select, follows the form's Reset, and can submit the form when
 * changed.
 */
export function AppSelect({
  id,
  name,
  value,
  defaultValue = "",
  onValueChange,
  options,
  placeholder,
  submitOnChange,
  disabled,
  className,
  contentClassName,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  submitOnChange?: boolean;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [own, setOwn] = useState(defaultValue);
  const current = value ?? own;
  const hidden = useRef<HTMLInputElement>(null);
  useFormReset(hidden, () => setOwn(defaultValue));

  function change(next: string) {
    const chosen = fromItem(next);
    setOwn(chosen);
    onValueChange?.(chosen);
    if (submitOnChange) {
      const form = hidden.current?.form;
      // After the hidden input holds the new value.
      if (form) setTimeout(() => form.requestSubmit());
    }
  }

  // With nothing chosen and no option for "", the placeholder shows. The
  // value stays controlled (""), so clearing it really clears the choice.
  const hasEmptyOption = options.some((o) => o.value === "");
  return (
    <>
      {name && <input ref={hidden} type="hidden" name={name} value={current} />}
      <Select
        value={current === "" && !hasEmptyOption ? "" : toItem(current)}
        onValueChange={change}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          data-value={current}
          className={cn(className)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={cn("max-h-72", contentClassName)}>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={toItem(option.value)}
              disabled={option.disabled}
              data-value={option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
