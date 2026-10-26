"use client";

import { useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type PillOption = {
  value: string;
  /** How the option reads in the list; its pill shows `value`. */
  label?: React.ReactNode;
};

/**
 * A dropdown whose choices appear as pills beside it (shared page
 * conventions, change 7). Several can be chosen unless `multiple` is false.
 * With `onOtherChange`, an "Other" choice opens a box for anything the list
 * doesn't cover.
 */
export function PillSelect({
  id,
  options,
  selected,
  onChange,
  multiple = true,
  placeholder = "Select",
  other = "",
  onOtherChange,
  otherLabel = "Other",
  otherPlaceholder = "Describe what you need",
  otherMultiline = false,
  invalid,
  describedBy,
}: {
  id: string;
  options: PillOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  other?: string;
  onOtherChange?: (text: string) => void;
  /** The "Other" box's accessible name, e.g. "Other venue requirements". */
  otherLabel?: string;
  otherPlaceholder?: string;
  otherMultiline?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [otherOn, setOtherOn] = useState(false);
  const [open, setOpen] = useState(false);
  // Set when Other is chosen, so its box takes the focus once the menu has
  // closed, rather than racing the menu for it.
  const focusOther = useRef(false);
  const showOther = Boolean(onOtherChange) && (otherOn || other.trim() !== "");

  function toggle(value: string) {
    if (!multiple) {
      // The one choice replaces the whole answer, Other text included.
      onChange(selected.includes(value) ? [] : [value]);
      setOtherOn(false);
      return;
    }
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  function closeOther() {
    setOtherOn(false);
    onOtherChange?.("");
  }

  function toggleOther() {
    if (showOther) return closeOther();
    setOtherOn(true);
    if (!multiple) onChange([]);
    focusOther.current = true;
    setOpen(false);
  }

  const OtherBox = otherMultiline ? Textarea : Input;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <button
              id={id}
              type="button"
              aria-describedby={describedBy}
              data-invalid={invalid || undefined}
              className="flex h-10 min-w-48 items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm text-muted-foreground shadow-sm transition-colors hover:border-primary/50 focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40 data-[invalid=true]:border-destructive data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-ring/40 [&[data-state=open]>svg]:rotate-180"
            >
              {placeholder}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60 transition-transform duration-200" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            onCloseAutoFocus={(e) => {
              if (!focusOther.current) return;
              focusOther.current = false;
              e.preventDefault();
              document.getElementById(`${id}-other`)?.focus();
            }}
            className="max-h-72 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-xl p-1.5 shadow-lg"
          >
            {options.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                data-option={option.value}
                checked={selected.includes(option.value)}
                onSelect={(e) => multiple && e.preventDefault()}
                onCheckedChange={() => toggle(option.value)}
                className="rounded-md py-2 focus:bg-primary/10"
              >
                {option.label ?? option.value}
              </DropdownMenuCheckboxItem>
            ))}
            {onOtherChange && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={showOther}
                  onCheckedChange={toggleOther}
                  className="rounded-md py-2 focus:bg-primary/10"
                >
                  Other
                </DropdownMenuCheckboxItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {selected.map((value) => (
          <span
            key={value}
            data-pill={value}
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 py-1 pl-3 pr-1 text-xs font-medium text-primary"
          >
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => toggle(value)}
              className="rounded-full p-0.5 transition-colors hover:bg-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      {showOther && (
        <div className="flex items-start gap-2">
          <OtherBox
            id={`${id}-other`}
            aria-label={otherLabel}
            placeholder={otherPlaceholder}
            value={other}
            onChange={(
              e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
            ) => onOtherChange!(e.target.value)}
            aria-invalid={invalid}
            className={cn(otherMultiline && "min-h-20")}
          />
          {/* Closing it drops what was typed, as unticking Other does. */}
          <button
            type="button"
            aria-label="Clear and close Other"
            title="Remove"
            onClick={closeOther}
            className="mt-2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
