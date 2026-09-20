"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ChevronRight,
  ChevronLeft,
  Eye,
  Calendar,
  Building2,
  Wrench,
  ClipboardList,
  Info,
  AlertCircle,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDateTime,
  parseSingaporeDateTime,
  timezoneWallTimeToUtcIso,
  utcToTimezoneWallTime,
  TIMEZONE_OPTIONS,
  parseIanaZone,
  normalizeTimezoneOption,
} from "@/lib/datetime";
import {
  createDraftEvent,
  submitEventRequest,
  getFormCatalogues,
} from "./actions";

/**
 * A datetime-local value ("2026-09-20T10:00") carries no timezone offset.
 * Converts local wall-time to UTC ISO instant ("...Z") according to selected timezone.
 */
function toUtcIso(localValue: string, timezoneStr: string = "Asia/Singapore (+08:00)"): string | undefined {
  if (!localValue) return undefined;
  return timezoneWallTimeToUtcIso(localValue, parseIanaZone(timezoneStr));
}

const COMMON_FACILITIES = [
  { value: "av-system", label: "AV System" },
  { value: "projector", label: "Projector" },
  { value: "microphones", label: "Microphones" },
  { value: "stage", label: "Stage" },
  { value: "whiteboard", label: "Whiteboard" },
  { value: "wheelchair-access", label: "Wheelchair Access" },
  { value: "wifi", label: "Wi-Fi" },
];

interface FormState {
  name: string;
  purpose: string;
  description: string;
  startAt: string;
  endAt: string;
  timezone: string;
  expectedAttendance: string;
  venueRequirements: string;
  requiredFacilities: string[];
  preferredLayout: string;
  accessibilityNeeds: string;
  equipmentRequirements: string;
  registrationNotes: string;
  programme: string;
  specialRequests: string;
}

const initialFormState: FormState = {
  name: "",
  purpose: "",
  description: "",
  startAt: "",
  endAt: "",
  timezone: "Asia/Singapore (+08:00)",
  expectedAttendance: "",
  venueRequirements: "",
  requiredFacilities: [],
  preferredLayout: "",
  accessibilityNeeds: "",
  equipmentRequirements: "",
  registrationNotes: "",
  programme: "",
  specialRequests: "",
};

const LAYOUT_OPTIONS = [
  "Theatre",
  "Classroom",
  "Banquet",
  "Boardroom",
  "U-Shape",
  "Cocktail / Standing",
];

export interface DraftEventData {
  id: string;
  name: string;
  status?: string;
  purpose?: string | null;
  description?: string | null;
  startAt?: Date | string | null;
  endAt?: Date | string | null;
  timezone?: string | null;
  expectedAttendance?: number | null;
  venueRequirements?: string | null;
  requiredFacilities?: string[];
  accessibilityNeeds?: string | null;
  preferredLayout?: string | null;
  equipmentRequirements?: string | null;
  registrationNotes?: string | null;
  programme?: string | null;
  specialRequests?: string | null;
}

interface CreateEventDialogProps {
  draftEvent?: DraftEventData | null;
  readOnly?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

/** Helper to format Date or ISO string into wall-time datetime-local format in selected timezone */
function toDatetimeInputString(
  dateVal: Date | string | null | undefined,
  timezoneStr: string = "Asia/Singapore (+08:00)",
): string {
  return utcToTimezoneWallTime(dateVal, parseIanaZone(timezoneStr));
}

/** Helper to format a naive wall-time string (YYYY-MM-DDTHH:mm) for display */
function formatWallDateTime(val: string | null | undefined): string {
  if (!val) return "";
  const d = parseSingaporeDateTime(val);
  return d ? formatDateTime(d) : val.replace("T", " ");
}

function getInitialFormData(draftEvent?: DraftEventData | null): FormState {
  if (!draftEvent) return initialFormState;
  const timezone = normalizeTimezoneOption(draftEvent.timezone);
  return {
    name: draftEvent.name || "",
    purpose: draftEvent.purpose || "",
    description: draftEvent.description || "",
    startAt: toDatetimeInputString(draftEvent.startAt, timezone),
    endAt: toDatetimeInputString(draftEvent.endAt, timezone),
    timezone,
    expectedAttendance:
      draftEvent.expectedAttendance !== null &&
      draftEvent.expectedAttendance !== undefined
        ? String(draftEvent.expectedAttendance)
        : "",
    venueRequirements: draftEvent.venueRequirements || "",
    requiredFacilities: draftEvent.requiredFacilities || [],
    preferredLayout: draftEvent.preferredLayout || "",
    accessibilityNeeds: draftEvent.accessibilityNeeds || "",
    equipmentRequirements: draftEvent.equipmentRequirements || "",
    registrationNotes: draftEvent.registrationNotes || "",
    programme: draftEvent.programme || "",
    specialRequests: draftEvent.specialRequests || "",
  };
}

export function CreateEventDialog({
  draftEvent,
  readOnly,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  trigger,
}: CreateEventDialogProps = {}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState<FormState>(() =>
    getInitialFormData(draftEvent),
  );
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [catalogues, setCatalogues] = useState<{
    venues: {
      id: string;
      name: string;
      capacity: number;
      facilities: string[];
    }[];
    equipment: { id: string; type: string; totalQuantity: number }[];
  }>({ venues: [], equipment: [] });

  const isReadOnly = Boolean(
    readOnly ||
      (draftEvent?.status &&
        draftEvent.status !== "DRAFT" &&
        draftEvent.status !== "REJECTED"),
  );
  const canSaveDraft = !draftEvent || draftEvent.status === "DRAFT";

  // Minimum start datetime computed in the user's selected event timezone
  const minStartDateTime = toDatetimeInputString(new Date(), formData.timezone);

  const [isDirty, setIsDirty] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [tzSearch, setTzSearch] = useState("");

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setFormData(getInitialFormData(draftEvent));
      setFieldErrors({});
      setStep(1);
      setIsDirty(false);
    }
  }

  useEffect(() => {
    if (open) {
      getFormCatalogues()
        .then((result) => {
          if (result.ok) setCatalogues(result.data);
        })
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (!isDirty || isReadOnly) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isReadOnly]);

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen && isDirty && !isReadOnly) {
      setShowExitConfirm(true);
      return;
    }

    forceCloseDialog(isOpen);
  }

  function forceCloseDialog(isOpen: boolean) {
    if (isControlled) {
      onOpenChangeProp?.(isOpen);
    } else {
      setInternalOpen(isOpen);
    }

    setFormData(getInitialFormData(draftEvent));
    setFieldErrors({});
    setStep(1);
    setIsDirty(false);
  }

  const minEndDateTime = formData.startAt ? formData.startAt : minStartDateTime;

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  /**
   * Validates explicit value range errors (e.g. past start date, end date <= start, negative attendance).
   * Does NOT block step navigation for missing mandatory fields (users can freely navigate).
   */
  function validateStep(currentStep: number): boolean {
    const errors: Record<string, string[]> = {};

    if (currentStep === 2) {
      if (formData.startAt) {
        const startIso = toUtcIso(formData.startAt, formData.timezone);
        if (startIso && new Date(startIso) < new Date()) {
          errors.startAt = ["Proposed date cannot be in the past."];
        }
      }
      if (formData.startAt && formData.endAt) {
        const startIso = toUtcIso(formData.startAt, formData.timezone);
        const endIso = toUtcIso(formData.endAt, formData.timezone);
        if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
          errors.endAt = [
            "Proposed end date and time must be strictly after the start date and time.",
          ];
        }
      }
      if (formData.expectedAttendance !== "") {
        const num = Number(formData.expectedAttendance);
        if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
          errors.expectedAttendance = [
            "Attendance must be a positive whole number.",
          ];
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      return false;
    }
    return true;
  }

  function nextStep() {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 6));
    }
  }

  function prevStep() {
    setStep((prev) => Math.max(prev - 1, 1));
  }

  function goToStep(targetStep: number) {
    if (validateStep(step)) {
      setStep(targetStep);
    }
  }

  async function handleSaveDraft() {
    startTransition(async () => {
      const payload = {
        id: draftEvent?.id,
        ...formData,
        name: formData.name.trim() || "Draft Event Request",
        expectedAttendance:
          formData.expectedAttendance !== ""
            ? Number(formData.expectedAttendance)
            : undefined,
        description: formData.description || undefined,
        purpose: formData.purpose || undefined,
        startAt: toUtcIso(formData.startAt, formData.timezone),
        endAt: toUtcIso(formData.endAt, formData.timezone),
      };

      const result = await createDraftEvent(payload);

      if (result.ok) {
        toast.success(
          draftEvent
            ? "Draft event request updated successfully."
            : "Draft event request saved successfully.",
        );
        resetForm();
        return;
      }

      setFieldErrors(result.fieldErrors ?? {});
      toast.error(result.error);
    });
  }

  async function handleSubmitForReview() {
    startTransition(async () => {
      const payload = {
        id: draftEvent?.id,
        ...formData,
        expectedAttendance:
          formData.expectedAttendance !== ""
            ? Number(formData.expectedAttendance)
            : undefined,
        // Empty string (not undefined) so a missing date gets the "required" message.
        startAt: toUtcIso(formData.startAt, formData.timezone) ?? "",
        endAt: toUtcIso(formData.endAt, formData.timezone) ?? "",
      };

      const result = await submitEventRequest(payload);

      if (result.ok) {
        toast.success("Event request submitted for review successfully!");
        resetForm();
        return;
      }

      setFieldErrors(result.fieldErrors ?? {});
      toast.error(
        result.error ||
          "Please complete all mandatory fields before submitting.",
      );
    });
  }

  function resetForm() {
    setFormData(initialFormState);
    setFieldErrors({});
    setStep(1);
    setIsDirty(false);
    forceCloseDialog(false);
    router.refresh();
  }

  // Check which mandatory submission fields are currently missing
  const missingSubmissionFields = {
    name: !formData.name.trim(),
    purpose: !formData.purpose.trim(),
    description: !formData.description.trim(),
    startAt: !formData.startAt,
    endAt: !formData.endAt,
    expectedAttendance: !formData.expectedAttendance,
    venueRequirements: !formData.venueRequirements.trim(),
    preferredLayout: !formData.preferredLayout.trim(),
    accessibilityNeeds: !formData.accessibilityNeeds.trim(),
    equipmentRequirements: !formData.equipmentRequirements.trim(),
    registrationNotes: !formData.registrationNotes.trim(),
  };

  const hasMissingSubmissionFields = Object.values(
    missingSubmissionFields,
  ).some(Boolean);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        !isControlled && (
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Event Request
            </Button>
          </DialogTrigger>
        )
      )}
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-8 text-xl font-bold">
            <span>
              {draftEvent
                ? isReadOnly
                  ? "Submitted Event Request Details"
                  : draftEvent.status === "REJECTED"
                    ? "Amend Rejected Event Request"
                    : "Resume Draft Event Request"
                : "Create Event Request"}
            </span>
            <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-normal text-primary">
              Step {step} of 6
            </span>
          </DialogTitle>
          <DialogDescription>
            {isReadOnly
              ? "Review the submitted details for this event request."
              : draftEvent?.status === "REJECTED"
                ? "Amend the request using the coordinator's feedback, then resubmit it for review."
                : "Provide your event requirements so ConnectSphere can plan your venue, equipment, and arrangements. You can save as a draft at any step."}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator Bar — Allows direct navigation between steps */}
        <div className="mb-4 flex items-center justify-between gap-2 overflow-x-auto border-b pb-3 text-xs font-medium text-muted-foreground">
          <button
            type="button"
            onClick={() => goToStep(1)}
            className={`flex items-center gap-1.5 rounded px-2 py-1 transition-colors ${step === 1 ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent"}`}
          >
            <Info className="h-3.5 w-3.5" /> 1. Basics
          </button>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <button
            type="button"
            onClick={() => goToStep(2)}
            className={`flex items-center gap-1.5 rounded px-2 py-1 transition-colors ${step === 2 ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent"}`}
          >
            <Calendar className="h-3.5 w-3.5" /> 2. Schedule
          </button>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <button
            type="button"
            onClick={() => goToStep(3)}
            className={`flex items-center gap-1.5 rounded px-2 py-1 transition-colors ${step === 3 ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent"}`}
          >
            <Building2 className="h-3.5 w-3.5" /> 3. Venue
          </button>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <button
            type="button"
            onClick={() => goToStep(4)}
            className={`flex items-center gap-1.5 rounded px-2 py-1 transition-colors ${step === 4 ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent"}`}
          >
            <Wrench className="h-3.5 w-3.5" /> 4. Equipment
          </button>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <button
            type="button"
            onClick={() => goToStep(5)}
            className={`flex items-center gap-1.5 rounded px-2 py-1 transition-colors ${step === 5 ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent"}`}
          >
            <ClipboardList className="h-3.5 w-3.5" /> 5. Details
          </button>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <button
            type="button"
            onClick={() => goToStep(6)}
            className={`flex items-center gap-1.5 rounded px-2 py-1 transition-colors ${step === 6 ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent"}`}
          >
            <Eye className="h-3.5 w-3.5" /> 6. Review
          </button>
        </div>

        {/* Step 1: Basic Event Information */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 border-b pb-2 text-base font-semibold">
              <Info className="h-4 w-4 text-primary" /> Basic Event Information
            </h3>
            <div className="space-y-2">
              <Label htmlFor="name">Event Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Annual Southeast Asia Tech Conference"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                aria-invalid={!!fieldErrors.name}
              />
              {fieldErrors.name?.map((msg) => (
                <p key={msg} className="text-xs text-destructive">
                  {msg}
                </p>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Event Purpose *</Label>
              <Textarea
                id="purpose"
                placeholder="Explain the goal and business objective of the event..."
                rows={3}
                value={formData.purpose}
                onChange={(e) => updateField("purpose", e.target.value)}
                aria-invalid={!!fieldErrors.purpose}
              />
              {fieldErrors.purpose?.map((msg) => (
                <p key={msg} className="text-xs text-destructive">
                  {msg}
                </p>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Event Description *</Label>
              <Textarea
                id="description"
                placeholder="Provide a detailed description of the event agenda, background, and overview..."
                rows={4}
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
                aria-invalid={!!fieldErrors.description}
              />
              {fieldErrors.description?.map((msg) => (
                <p key={msg} className="text-xs text-destructive">
                  {msg}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Proposed Schedule & Attendance */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 border-b pb-2 text-base font-semibold">
              <Calendar className="h-4 w-4 text-primary" /> Schedule &
              Attendance
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startAt">Proposed Start Date & Time *</Label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  min={minStartDateTime}
                  value={formData.startAt}
                  onChange={(e) => updateField("startAt", e.target.value)}
                  aria-invalid={!!fieldErrors.startAt}
                  className="relative w-full max-w-xs cursor-pointer pr-8 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                {fieldErrors.startAt?.map((msg) => (
                  <p key={msg} className="text-xs text-destructive">
                    {msg}
                  </p>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  Must be a future date & time.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endAt">Proposed End Date & Time *</Label>
                <Input
                  id="endAt"
                  type="datetime-local"
                  min={minEndDateTime}
                  value={formData.endAt}
                  onChange={(e) => updateField("endAt", e.target.value)}
                  aria-invalid={!!fieldErrors.endAt}
                  className="relative w-full max-w-xs cursor-pointer pr-8 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                {fieldErrors.endAt?.map((msg) => (
                  <p key={msg} className="text-xs text-destructive">
                    {msg}
                  </p>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  Must be strictly after start date & time.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Event Timezone *</Label>
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Type to filter timezones (e.g. New York, Tokyo, London, Singapore)..."
                    value={tzSearch}
                    onChange={(e) => {
                      const query = e.target.value;
                      setTzSearch(query);
                      if (query.trim()) {
                        const q = query.toLowerCase();
                        const match = TIMEZONE_OPTIONS.find(
                          (opt) =>
                            opt.label.toLowerCase().includes(q) ||
                            opt.value.toLowerCase().includes(q) ||
                            opt.iana.toLowerCase().includes(q),
                        );
                        if (match) {
                          updateField("timezone", match.value);
                        }
                      }
                    }}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
                <select
                  id="timezone"
                  value={formData.timezone}
                  onChange={(e) => updateField("timezone", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {TIMEZONE_OPTIONS.filter((opt) => {
                    if (opt.value === formData.timezone) return true;
                    if (!tzSearch.trim()) return true;
                    const q = tzSearch.toLowerCase();
                    return (
                      opt.label.toLowerCase().includes(q) ||
                      opt.value.toLowerCase().includes(q) ||
                      opt.iana.toLowerCase().includes(q)
                    );
                  }).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Authoritative timezone for schedule interpretation. Persisted instants stored consistently in UTC.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedAttendance">Expected Attendance *</Label>
              <Input
                id="expectedAttendance"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 150"
                value={formData.expectedAttendance}
                onKeyDown={(e) => {
                  if (
                    e.key === "-" ||
                    e.key === "e" ||
                    e.key === "+" ||
                    e.key === "."
                  ) {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || Number(val) > 0) {
                    updateField("expectedAttendance", val);
                  }
                }}
                aria-invalid={!!fieldErrors.expectedAttendance}
              />
              {fieldErrors.expectedAttendance?.map((msg) => (
                <p key={msg} className="text-xs text-destructive">
                  {msg}
                </p>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Must be a positive whole number greater than 0.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Venue & Accessibility Requirements (Grouped together) */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 border-b pb-2 text-base font-semibold">
              <Building2 className="h-4 w-4 text-primary" /> Venue, Layout &
              Accessibility Requirements
            </h3>

            {catalogues.venues.length > 0 && (
              <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-xs">
                <p className="font-medium text-foreground">
                  Available ConnectSphere Venues Catalogue:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {catalogues.venues.map((v) => (
                    <span
                      key={v.id}
                      className="cursor-pointer rounded border bg-background px-2 py-0.5 text-xs hover:bg-accent"
                      onClick={() =>
                        updateField(
                          "venueRequirements",
                          formData.venueRequirements
                            ? `${formData.venueRequirements}, ${v.name}`
                            : `Preferred venue: ${v.name} (Cap: ${v.capacity})`,
                        )
                      }
                    >
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Required Facilities</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_FACILITIES.map((facility) => {
                  const selected = formData.requiredFacilities.includes(facility.value);
                  return (
                    <Button
                      key={facility.value}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        const next = selected
                          ? formData.requiredFacilities.filter((f) => f !== facility.value)
                          : [...formData.requiredFacilities, facility.value];
                        updateField("requiredFacilities", next);
                      }}
                    >
                      {facility.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="venueRequirements">Venue Requirements *</Label>
              <Textarea
                id="venueRequirements"
                placeholder="Specify space size, hall preference, or specific space requirements..."
                rows={3}
                value={formData.venueRequirements}
                onChange={(e) =>
                  updateField("venueRequirements", e.target.value)
                }
                aria-invalid={!!fieldErrors.venueRequirements}
              />
              {fieldErrors.venueRequirements?.map((msg) => (
                <p key={msg} className="text-xs text-destructive">
                  {msg}
                </p>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredLayout">Preferred Room Layout *</Label>
              <div className="mb-2 flex flex-wrap gap-2">
                {LAYOUT_OPTIONS.map((layout) => (
                  <Button
                    key={layout}
                    type="button"
                    variant={
                      formData.preferredLayout === layout
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => updateField("preferredLayout", layout)}
                  >
                    {layout}
                  </Button>
                ))}
              </div>
              <Input
                id="preferredLayout"
                placeholder="e.g. Theatre style or custom arrangement"
                value={formData.preferredLayout}
                onChange={(e) => updateField("preferredLayout", e.target.value)}
                aria-invalid={!!fieldErrors.preferredLayout}
              />
              {fieldErrors.preferredLayout?.map((msg) => (
                <p key={msg} className="text-xs text-destructive">
                  {msg}
                </p>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessibilityNeeds">Accessibility Needs *</Label>
              <Textarea
                id="accessibilityNeeds"
                placeholder="State any wheelchair access, special physical seating, mobility, or facility arrangements required for attendees..."
                rows={3}
                value={formData.accessibilityNeeds}
                onChange={(e) =>
                  updateField("accessibilityNeeds", e.target.value)
                }
                aria-invalid={!!fieldErrors.accessibilityNeeds}
              />
              {fieldErrors.accessibilityNeeds?.map((msg) => (
                <p key={msg} className="text-xs text-destructive">
                  {msg}
                </p>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Include wheelchair access, ramp access, physical seating
                arrangements, or hearing loops.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Equipment Requirements (Grouped together) */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 border-b pb-2 text-base font-semibold">
              <Wrench className="h-4 w-4 text-primary" /> Equipment & Technical
              Support Requirements
            </h3>

            {catalogues.equipment.length > 0 && (
              <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-xs">
                <p className="font-medium text-foreground">
                  ConnectSphere Equipment Catalogue:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {catalogues.equipment.map((eq) => (
                    <span
                      key={eq.id}
                      className="cursor-pointer rounded border bg-background px-2 py-0.5 text-xs hover:bg-accent"
                      onClick={() =>
                        updateField(
                          "equipmentRequirements",
                          formData.equipmentRequirements
                            ? `${formData.equipmentRequirements}, ${eq.type}`
                            : `Requested equipment: ${eq.type}`,
                        )
                      }
                    >
                      {eq.type} (Avail: {eq.totalQuantity})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="equipmentRequirements">
                Equipment & Technical Support Requirements *
              </Label>
              <Textarea
                id="equipmentRequirements"
                placeholder="List required technical equipment (microphones, projectors, sound systems, live streaming, technical staff support)..."
                rows={5}
                value={formData.equipmentRequirements}
                onChange={(e) =>
                  updateField("equipmentRequirements", e.target.value)
                }
                aria-invalid={!!fieldErrors.equipmentRequirements}
              />
              {fieldErrors.equipmentRequirements?.map((msg) => (
                <p key={msg} className="text-xs text-destructive">
                  {msg}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Registration Needs & Programme */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 border-b pb-2 text-base font-semibold">
              <ClipboardList className="h-4 w-4 text-primary" /> Registration &
              Additional Details
            </h3>

            <div className="space-y-2">
              <Label htmlFor="registrationNotes">Registration Needs *</Label>
              <Textarea
                id="registrationNotes"
                placeholder="Describe attendee registration needs (e.g., online registration open to public, max capacity limit, check-in desks)..."
                rows={3}
                value={formData.registrationNotes}
                onChange={(e) =>
                  updateField("registrationNotes", e.target.value)
                }
                aria-invalid={!!fieldErrors.registrationNotes}
              />
              {fieldErrors.registrationNotes?.map((msg) => (
                <p key={msg} className="text-xs text-destructive">
                  {msg}
                </p>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="programme">Event Programme (Optional)</Label>
              <Textarea
                id="programme"
                placeholder="Outline the event schedule, keynotes, breaks, and session timeline..."
                rows={3}
                value={formData.programme}
                onChange={(e) => updateField("programme", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialRequests">
                Special Requests / Arrangements (Optional)
              </Label>
              <Textarea
                id="specialRequests"
                placeholder="Detail any special catering, security, VIP reception, or custom logistics needed..."
                rows={3}
                value={formData.specialRequests}
                onChange={(e) => updateField("specialRequests", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step 6: Review & Confirmation Step */}
        {step === 6 && (
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 border-b pb-2 text-base font-semibold">
              <Eye className="h-4 w-4 text-primary" /> Review Entered Details
            </h3>

            {hasMissingSubmissionFields ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/15 p-3 text-xs text-warning-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div>
                  <p className="font-semibold">
                    Draft can be saved at any time.
                  </p>
                  <p className="mt-0.5">
                    To submit this request for ConnectSphere review, please
                    complete all required fields highlighted in red below.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                All required details have been filled. You can submit this
                request for review or save it as a draft.
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="overflow-hidden">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center justify-between text-sm font-semibold">
                    <span>1. Basic Information</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setStep(1)}
                    >
                      Edit
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 px-4 pb-3 text-xs">
                  <p>
                    <span className="font-semibold">Name:</span>{" "}
                    {formData.name.trim() || (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                        Missing (Required to Submit)
                      </span>
                    )}
                  </p>
                  <p>
                    <span className="font-semibold">Purpose:</span>{" "}
                    {formData.purpose.trim() || (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                        Missing (Required to Submit)
                      </span>
                    )}
                  </p>
                  <p>
                    <span className="font-semibold">Description:</span>{" "}
                    {formData.description.trim() || (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                        Missing (Required to Submit)
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center justify-between text-sm font-semibold">
                    <span>2. Schedule & Attendance</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setStep(2)}
                    >
                      Edit
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 px-4 pb-3 text-xs">
                  <p>
                    <span className="font-semibold">Start:</span>{" "}
                    {formData.startAt ? (
                      formatWallDateTime(formData.startAt)
                    ) : (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                        Missing (Required to Submit)
                      </span>
                    )}
                  </p>
                  <p>
                    <span className="font-semibold">End:</span>{" "}
                    {formData.endAt ? (
                      formatWallDateTime(formData.endAt)
                    ) : (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                        Missing (Required to Submit)
                      </span>
                    )}
                  </p>
                  <p>
                    <span className="font-semibold">Timezone:</span>{" "}
                    {formData.timezone || "Asia/Singapore (+08:00)"}
                  </p>
                  <p>
                    <span className="font-semibold">Attendance:</span>{" "}
                    {formData.expectedAttendance || (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                        Missing (Required to Submit)
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center justify-between text-sm font-semibold">
                    <span>3. Venue & Accessibility</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setStep(3)}
                    >
                      Edit
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 px-4 pb-3 text-xs">
                  <p>
                    <span className="font-semibold">Venue Requirements:</span>{" "}
                    {formData.venueRequirements.trim() || (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                        Missing (Required to Submit)
                      </span>
                    )}
                  </p>
                  {formData.requiredFacilities.length > 0 && (
                    <p>
                      <span className="font-semibold">Facilities:</span>{" "}
                      {formData.requiredFacilities
                        .map((f) => COMMON_FACILITIES.find((c) => c.value === f)?.label || f)
                        .join(", ")}
                    </p>
                  )}
                  <p>
                    <span className="font-semibold">Preferred Layout:</span>{" "}
                    {formData.preferredLayout.trim() || (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                        Missing (Required to Submit)
                      </span>
                    )}
                  </p>
                  <p>
                    <span className="font-semibold">Accessibility Needs:</span>{" "}
                    {formData.accessibilityNeeds.trim() || (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                        Missing (Required to Submit)
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center justify-between text-sm font-semibold">
                    <span>4. Equipment & Support</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setStep(4)}
                    >
                      Edit
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 px-4 pb-3 text-xs">
                  <p>
                    <span className="font-semibold">Requirements:</span>{" "}
                    {formData.equipmentRequirements.trim() || (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                        Missing (Required to Submit)
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>

              <Card className="overflow-hidden md:col-span-2">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center justify-between text-sm font-semibold">
                    <span>5. Registration & Additional Details</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setStep(5)}
                    >
                      Edit
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-2 space-y-1 px-4 pb-3 text-xs md:grid-cols-3">
                  <div>
                    <span className="font-semibold">Registration Needs:</span>
                    <p className="text-muted-foreground">
                      {formData.registrationNotes.trim() || (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                          Missing (Required to Submit)
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold">Programme:</span>
                    <p className="text-muted-foreground">
                      {formData.programme || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold">Special Requests:</span>
                    <p className="text-muted-foreground">
                      {formData.specialRequests || "None"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col items-center justify-between gap-2 border-t pt-4 sm:flex-row">
          <div className="flex w-full items-center justify-start gap-2 sm:w-auto">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={prevStep}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
            )}
            {!isReadOnly && canSaveDraft && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isPending}
                onClick={handleSaveDraft}
              >
                Save as Draft
              </Button>
            )}
          </div>

          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            {step < 6 ? (
              <Button type="button" size="sm" onClick={nextStep}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : isReadOnly ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleOpenChange(false)}
              >
                Close
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isPending}
                onClick={handleSubmitForReview}
              >
                {isPending ? "Submitting..." : "Submit Request for Review"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" /> Unsaved Changes
          </DialogTitle>
          <DialogDescription>
            You have unsaved changes in this event request. If you close without saving, your edits will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setShowExitConfirm(false)}>
            Continue Editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setShowExitConfirm(false);
              forceCloseDialog(false);
            }}
          >
            Discard Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
