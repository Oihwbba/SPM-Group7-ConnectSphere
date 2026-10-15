"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toTag } from "@/lib/schemas/venue";
import { tagLabel } from "@/lib/venue-options";

/**
 * SCRUM-34 AC3, AC6 — choose several of a venue's facilities, accessibility
 * features or layouts from the options, or add a new one. A new one is saved
 * on the venue and offered from then on (lib/venue-options.ts).
 */
export function OptionPicker({
  id,
  legend,
  noun,
  options,
  selected,
  onChange,
  errors,
}: {
  id: string;
  legend: string;
  /** "facility", for "Add a facility"; "accessibility feature", for "Add an …" */
  noun: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  errors?: string[];
}) {
  const [draft, setDraft] = useState("");
  const adding = `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
  // A value already on the venue stays choosable even if no other venue has it.
  const shown = [...options, ...selected.filter((tag) => !options.includes(tag))];

  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);
  }

  function add() {
    const tag = toTag(draft);
    if (tag && !selected.includes(tag)) onChange([...selected, tag]);
    setDraft("");
  }

  return (
    <fieldset className="space-y-2" aria-describedby={errors?.[0] ? `${id}-error` : undefined}>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {shown.map((tag) => (
          <Button
            key={tag}
            type="button"
            size="sm"
            variant={selected.includes(tag) ? "default" : "outline"}
            className="h-8 text-xs"
            aria-pressed={selected.includes(tag)}
            onClick={() => toggle(tag)}
          >
            {tagLabel(tag)}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Label htmlFor={`${id}-new`} className="sr-only">
          Add {adding}
        </Label>
        <Input
          id={`${id}-new`}
          value={draft}
          placeholder={`Add ${adding} not listed`}
          aria-invalid={Boolean(errors?.[0])}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="gap-1"
          aria-label={`Add ${noun}`}
          disabled={!toTag(draft)}
          onClick={add}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      <FieldError id={`${id}-error`} messages={errors} />
    </fieldset>
  );
}
