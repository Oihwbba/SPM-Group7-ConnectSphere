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
  Check,
  Save,
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
import { DateTimePicker } from "@/components/app/date-time-picker";
import { PillSelect } from "@/components/app/pill-select";
import { Stepper } from "@/components/app/stepper";
import { CapacityTag } from "@/components/app/capacity-tag";
import {
  joinChoices,
  splitChoice,
  splitChoices,
} from "@/lib/requirement-choices";
import {
  formatDate,
  formatTime,
  joinEventPeriod,
  sgDate,
  splitEventPeriod,
} from "@/lib/datetime";
import {
  createDraftEvent,
  submitEventRequest,
  getFormCatalogues,
} from "./actions";
import {
  LAYOUT_OPTIONS,
  PAST_DRAFT_DATES_MESSAGE,
  draftStartIsInPast,
  eventPeriodError,
} from "@/lib/schemas/event";
import {
  PREDEFINED_VENUE_OPTIONS,
  tagLabel,
  withVenueLayouts,
  type VenueOptions,
} from "@/lib/venue-options";
import { ActionError } from "@/components/app/action-error";

interface FormState {
  name: string;
  purpose: string;
  description: string;
  /** SCRUM-190 AC1: one date with a start and an end time, Singapore time. */
  eventDate: string;
  startTime: string;
  endTime: string;
  expectedAttendance: string;
  venueRequirements: string;
  requiredFacilities: string[];
  preferredLayout: string;
  accessibilityNeeds: string;
  equipmentRequirements: string;
  /** SCRUM-171 AC1: Registration needed, unanswered until chosen. */
  registrationRequired: "" | "yes" | "no";
  registrationNotes: string;
  programme: string;
  specialRequests: string;
}

const initialFormState: FormState = {
  name: "",
  purpose: "",
  description: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  expectedAttendance: "",
  venueRequirements: "",
  requiredFacilities: [],
  preferredLayout: "",
  accessibilityNeeds: "",
  equipmentRequirements: "",
  registrationRequired: "",
  registrationNotes: "",
  programme: "",
  specialRequests: "",
};

export interface DraftEventData {
  id: string;
  name: string;
  status?: string;
  purpose?: string | null;
  description?: string | null;
  startAt?: Date | string | null;
  endAt?: Date | string | null;
  expectedAttendance?: number | null;
  venueRequirements?: string | null;
  requiredFacilities?: string[];
  accessibilityNeeds?: string | null;
  preferredLayout?: string | null;
  equipmentRequirements?: string | null;
  registrationRequired?: boolean | null;
  registrationNotes?: string | null;
  programme?: string | null;
  specialRequests?: string | null;
  decisionReason?: string | null;
}

interface CreateEventDialogProps {
  draftEvent?: DraftEventData | null;
  readOnly?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  /** Called with the request's id once it is submitted for review. */
  onSubmitted?: (id: string) => void;
}

const STEPS = ["Basics", "Schedule", "Venue", "Equipment", "Details", "Review"];

// How the catalogue choices are written into the free-text answers, as the
// catalogue buttons wrote them (lib/requirement-choices.ts).
const VENUE_PREFIX = "Preferred venue: ";
const EQUIPMENT_PREFIX = "Requested equipment: ";

/** The form's date and times as the UTC instants the actions take. */
function periodOf(form: FormState) {
  return joinEventPeriod({
    date: form.eventDate,
    startTime: form.startTime,
    endTime: form.endTime,
  });
}

export const REENTER_PERIOD_MESSAGE =
  "Events now take place within one day. Please choose the date and times again.";

/**
 * SCRUM-190 AC3 — a Draft or Rejected request saved across two Singapore days
 * before the one-day rule. One date can't show it, and joining its fields would
 * move the end onto the start's day, so the Organiser chooses the period again.
 */
export function storedAcrossTwoDays(draftEvent?: DraftEventData | null) {
  return Boolean(
    draftEvent?.startAt &&
      draftEvent.endAt &&
      (draftEvent.status === "DRAFT" || draftEvent.status === "REJECTED") &&
      sgDate(draftEvent.startAt) !== sgDate(draftEvent.endAt),
  );
}

/** The form as a draft or rejected request reopens. Exported for its unit test. */
export function getInitialFormData(draftEvent?: DraftEventData | null): FormState {
  if (!draftEvent) return initialFormState;
  // SCRUM-129 AC2: a draft saved under another timezone keeps its stored
  // instants; they are simply shown and edited as Singapore wall time.
  const period = storedAcrossTwoDays(draftEvent)
    ? { date: "", startTime: "", endTime: "" }
    : splitEventPeriod(draftEvent.startAt, draftEvent.endAt);
  return {
    name: draftEvent.name || "",
    purpose: draftEvent.purpose || "",
    description: draftEvent.description || "",
    eventDate: period.date,
    startTime: period.startTime,
    endTime: period.endTime,
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
    registrationRequired:
      draftEvent.registrationRequired === true
        ? "yes"
        : draftEvent.registrationRequired === false
          ? "no"
          : "",
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
  onSubmitted,
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
  // SCRUM-207 AC4: the form's own error, shown above its buttons.
  const [formError, setFormError] = useState<string | null>(null);
  const [catalogues, setCatalogues] = useState<{
    venues: {
      id: string;
      name: string;
      capacity: number;
      facilities: string[];
    }[];
    equipment: { id: string; type: string; totalQuantity: number }[];
    options: VenueOptions;
  }>({ venues: [], equipment: [], options: PREDEFINED_VENUE_OPTIONS });

  const isReadOnly = Boolean(
    readOnly ||
      (draftEvent?.status &&
        draftEvent.status !== "DRAFT" &&
        draftEvent.status !== "REJECTED"),
  );
  const canSaveDraft = !draftEvent || draftEvent.status === "DRAFT";


  const [isDirty, setIsDirty] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // A new request saved as a draft while the form stays open: later saves,
  // and the submission, update that draft rather than creating another.
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const eventId = draftEvent?.id ?? savedDraftId ?? undefined;

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setFormData(getInitialFormData(draftEvent));
      setFieldErrors({});
      setStep(1);
      setIsDirty(false);
      setSavedDraftId(null);
      setJustSaved(false);
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
    setSavedDraftId(null);
    setJustSaved(false);
  }


  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setJustSaved(false);
    // The date and times are checked, and reported, as the start and end.
    const reportedAs: string[] =
      key === "eventDate" || key === "startTime"
        ? ["startAt", "endAt"]
        : key === "endTime"
          ? ["endAt"]
          : [key];
    if (reportedAs.some((field) => fieldErrors[field])) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        for (const field of reportedAs) delete next[field];
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
      const { startAt, endAt } = periodOf(formData);
      if (startAt && new Date(startAt) < new Date()) {
        errors.startAt = ["Proposed date cannot be in the past."];
      }
      // SCRUM-190 AC2: the same rule the actions apply.
      const periodError =
        startAt && endAt && eventPeriodError(new Date(startAt), new Date(endAt));
      if (periodError) errors.endAt = [periodError];
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
    setSavingDraft(true);
    startTransition(async () => {
      setFormError(null);
      const payload = {
        id: eventId,
        ...formData,
        name: formData.name.trim() || "Draft Event Request",
        expectedAttendance:
          formData.expectedAttendance !== ""
            ? Number(formData.expectedAttendance)
            : undefined,
        description: formData.description || undefined,
        purpose: formData.purpose || undefined,
        // SCRUM-190 AC3: a draft can still be saved without a date or times.
        ...periodOf(formData),
      };

      const result = await createDraftEvent(payload);
      setSavingDraft(false);

      if (result.ok) {
        toast.success(
          eventId
            ? "Draft event request updated successfully."
            : "Draft event request saved successfully.",
        );
        // Change 2: the form stays open, and the button says it was saved.
        setSavedDraftId(result.data.id);
        setIsDirty(false);
        setJustSaved(true);
        setFieldErrors({});
        router.refresh();
        return;
      }

      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.error);
    });
  }

  async function handleSubmitForReview() {
    startTransition(async () => {
      setFormError(null);
      const payload = {
        id: eventId,
        ...formData,
        expectedAttendance:
          formData.expectedAttendance !== ""
            ? Number(formData.expectedAttendance)
            : undefined,
        // Empty string (not undefined) so a missing date or time gets the "required" message.
        startAt: periodOf(formData).startAt ?? "",
        endAt: periodOf(formData).endAt ?? "",
      };

      const result = await submitEventRequest(payload);

      if (result.ok) {
        toast.success("Event request submitted for review successfully!");
        resetForm();
        onSubmitted?.(result.data.id);
        return;
      }

      setFieldErrors(result.fieldErrors ?? {});
      setFormError(
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

  // Change 7: the free-text answers shown as choices plus "Other".
  const layoutOptions = withVenueLayouts(
    LAYOUT_OPTIONS,
    catalogues.options.supportedLayouts,
  );
  const accessibilityOptions =
    catalogues.options.accessibilityFeatures.map(tagLabel);
  const venueChoices = splitChoices(
    formData.venueRequirements,
    catalogues.venues.map((v) => v.name),
    VENUE_PREFIX,
  );
  const layoutChoice = splitChoice(formData.preferredLayout, layoutOptions);
  const accessibilityChoices = splitChoices(
    formData.accessibilityNeeds,
    accessibilityOptions,
  );
  const equipmentChoices = splitChoices(
    formData.equipmentRequirements,
    catalogues.equipment.map((eq) => eq.type),
    EQUIPMENT_PREFIX,
  );

  // Check which mandatory submission fields are currently missing
  const missingSubmissionFields = {
    name: !formData.name.trim(),
    purpose: !formData.purpose.trim(),
    description: !formData.description.trim(),
    eventDate: !formData.eventDate,
    startTime: !formData.startTime,
    endTime: !formData.endTime,
    expectedAttendance: !formData.expectedAttendance,
    venueRequirements: !formData.venueRequirements.trim(),
    preferredLayout: !formData.preferredLayout.trim(),
    accessibilityNeeds: !formData.accessibilityNeeds.trim(),
    equipmentRequirements: !formData.equipmentRequirements.trim(),
    registrationRequired: !formData.registrationRequired,
  };

  const reviewPeriod = periodOf(formData);

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
          <DialogTitle className="pr-8 text-xl font-bold">
            {draftEvent
              ? isReadOnly
                ? "Submitted Event Request Details"
                : draftEvent.status === "REJECTED"
                  ? "Amend Rejected Event Request"
                  : "Resume Draft Event Request"
              : "Create Event Request"}
          </DialogTitle>
          <DialogDescription>
            {isReadOnly
              ? "Review the submitted details for this event request."
              : draftEvent?.status === "REJECTED"
                ? "Amend the request using the coordinator's feedback, then resubmit it for review."
                : "Provide your event requirements so ConnectSphere can plan your venue, equipment, and arrangements. You can save as a draft at any step."}
          </DialogDescription>
        </DialogHeader>

        {/* SCRUM-108 AC7: the reason stays in view on every step of the amendment. */}
        {draftEvent?.status === "REJECTED" && draftEvent.decisionReason && (
          <div
            data-testid="amend-rejection-reason"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs"
          >
            <span className="font-semibold text-destructive">
              Rejection reason:
            </span>{" "}
            <span className="whitespace-pre-wrap">{draftEvent.decisionReason}</span>
          </div>
        )}

        {/* SCRUM-130 AC6: follows the field, so it clears once the start is
            moved to the future. */}
        {draftEvent?.status === "DRAFT" &&
          draftStartIsInPast(periodOf(formData).startAt) && (
            <div
              role="alert"
              data-testid="draft-dates-in-past"
              className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {PAST_DRAFT_DATES_MESSAGE}
            </div>
          )}

        {/* Change 1: one clean line of steps. Any step can be visited. */}
        <div className="mb-2 min-w-0">
          <Stepper steps={STEPS} current={step} onStep={goToStep} />
        </div>

        {/* Step 1: Basic Event Information */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-base font-semibold">
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
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Calendar className="h-4 w-4 text-primary" /> Schedule &
              Attendance
            </h3>
            {storedAcrossTwoDays(draftEvent) && (
              <p
                role="status"
                data-testid="reenter-period"
                className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs"
              >
                {REENTER_PERIOD_MESSAGE}
              </p>
            )}
            {/* SCRUM-190 AC1: an event takes place within one day. */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="eventDate">Event Date *</Label>
                <DateTimePicker
                  id="eventDate"
                  mode="date"
                  value={formData.eventDate}
                  onChange={(value) => updateField("eventDate", value)}
                  aria-invalid={!!fieldErrors.startAt}
                  aria-describedby="startAt-error"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <DateTimePicker
                  id="startTime"
                  mode="time"
                  value={formData.startTime}
                  onChange={(value) => updateField("startTime", value)}
                  aria-invalid={!!fieldErrors.startAt}
                  aria-describedby="startAt-error"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime">End Time *</Label>
                <DateTimePicker
                  id="endTime"
                  mode="time"
                  value={formData.endTime}
                  onChange={(value) => updateField("endTime", value)}
                  aria-invalid={!!fieldErrors.endAt}
                  aria-describedby="endAt-error"
                />
              </div>
            </div>

            <div id="startAt-error">
              {fieldErrors.startAt?.map((msg) => (
                <p key={msg} className="text-xs text-destructive">
                  {msg}
                </p>
              ))}
            </div>
            <div id="endAt-error">
              {fieldErrors.endAt?.map((msg) => (
                <p key={msg} className="text-xs text-destructive">
                  {msg}
                </p>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground">
              A future date; the end time must be after the start time on
              the same day. All times are Singapore time (SGT, UTC+8).
            </p>

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
            </div>
          </div>
        )}

        {/* Step 3: Venue & Accessibility Requirements (Grouped together) */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Building2 className="h-4 w-4 text-primary" /> Venue, Layout &
              Accessibility Requirements
            </h3>

            <div className="space-y-2">
              <Label htmlFor="venueRequirements">Venue Requirements *</Label>
              <PillSelect
                id="venueRequirements"
                placeholder="Select venues"
                options={catalogues.venues.map((v) => ({
                  value: v.name,
                  label: (
                    <span className="flex w-full items-center justify-between gap-3">
                      {v.name}
                      <CapacityTag capacity={v.capacity} />
                    </span>
                  ),
                }))}
                selected={venueChoices.chosen}
                onChange={(chosen) =>
                  updateField(
                    "venueRequirements",
                    joinChoices({ ...venueChoices, chosen }, VENUE_PREFIX),
                  )
                }
                other={venueChoices.other}
                onOtherChange={(other) =>
                  updateField(
                    "venueRequirements",
                    joinChoices({ ...venueChoices, other }, VENUE_PREFIX),
                  )
                }
                otherLabel="Other venue requirements"
                otherPlaceholder="Specify space size, hall preference, or specific space requirements..."
                otherMultiline
                invalid={!!fieldErrors.venueRequirements}
              />
              {fieldErrors.venueRequirements?.map((msg) => (
                <p key={msg} className="text-xs text-destructive">
                  {msg}
                </p>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredLayout">Preferred Room Layout *</Label>
              <PillSelect
                id="preferredLayout"
                multiple={false}
                placeholder="Select a layout"
                options={layoutOptions.map((value) => ({ value }))}
                selected={layoutChoice.chosen}
                onChange={([chosen = ""]) =>
                  updateField("preferredLayout", chosen)
                }
                other={layoutChoice.other}
                onOtherChange={(other) => updateField("preferredLayout", other)}
                otherLabel="Other room layout"
                otherPlaceholder="e.g. Theatre style or custom arrangement"
                invalid={!!fieldErrors.preferredLayout}
              />
              {fieldErrors.preferredLayout?.map((msg) => (
                <p key={msg} className="text-xs text-destructive">
                  {msg}
                </p>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessibilityNeeds">Accessibility Needs *</Label>
              {/* SCRUM-34 AC6: the features venues offer, Venue Staff's own included. */}
              <PillSelect
                id="accessibilityNeeds"
                placeholder="Select accessibility needs"
                options={accessibilityOptions.map((value) => ({ value }))}
                selected={accessibilityChoices.chosen}
                onChange={(chosen) =>
                  updateField(
                    "accessibilityNeeds",
                    joinChoices({ ...accessibilityChoices, chosen }),
                  )
                }
                other={accessibilityChoices.other}
                onOtherChange={(other) =>
                  updateField(
                    "accessibilityNeeds",
                    joinChoices({ ...accessibilityChoices, other }),
                  )
                }
                otherLabel="Other accessibility needs"
                otherPlaceholder="State any wheelchair access, special physical seating, mobility, or facility arrangements required for attendees..."
                otherMultiline
                invalid={!!fieldErrors.accessibilityNeeds}
              />
              {fieldErrors.accessibilityNeeds?.map((msg) => (
                <p key={msg} className="text-xs text-destructive">
                  {msg}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Equipment Requirements (Grouped together) */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Wrench className="h-4 w-4 text-primary" /> Equipment & Technical
              Support Requirements
            </h3>

            <div className="space-y-2">
              <Label htmlFor="equipmentRequirements">
                Equipment & Technical Support Requirements *
              </Label>
              <PillSelect
                id="equipmentRequirements"
                placeholder="Select equipment"
                options={catalogues.equipment.map((eq) => ({
                  value: eq.type,
                  label: (
                    <span className="flex w-full items-center justify-between gap-3">
                      {eq.type}
                      <span className="text-xs text-muted-foreground">
                        {eq.totalQuantity} available
                      </span>
                    </span>
                  ),
                }))}
                selected={equipmentChoices.chosen}
                onChange={(chosen) =>
                  updateField(
                    "equipmentRequirements",
                    joinChoices({ ...equipmentChoices, chosen }, EQUIPMENT_PREFIX),
                  )
                }
                other={equipmentChoices.other}
                onOtherChange={(other) =>
                  updateField(
                    "equipmentRequirements",
                    joinChoices({ ...equipmentChoices, other }, EQUIPMENT_PREFIX),
                  )
                }
                otherLabel="Other equipment and technical support"
                otherPlaceholder="List required technical equipment (microphones, projectors, sound systems, live streaming, technical staff support)..."
                otherMultiline
                invalid={!!fieldErrors.equipmentRequirements}
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
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <ClipboardList className="h-4 w-4 text-primary" /> Registration &
              Additional Details
            </h3>

            {/* SCRUM-171 AC1, AC2: required to submit, not to save a draft. */}
            <fieldset
              className="space-y-2"
              aria-describedby={
                fieldErrors.registrationRequired
                  ? "registrationRequired-error"
                  : undefined
              }
            >
              <legend className="text-sm font-medium">
                Registration Needed *
              </legend>
              <div className="flex gap-4">
                {(["yes", "no"] as const).map((value) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="registrationRequired"
                      value={value}
                      checked={formData.registrationRequired === value}
                      onChange={() =>
                        updateField("registrationRequired", value)
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    {value === "yes" ? "Yes" : "No"}
                  </label>
                ))}
              </div>
              {fieldErrors.registrationRequired?.map((msg) => (
                <p
                  key={msg}
                  id="registrationRequired-error"
                  className="text-xs text-destructive"
                >
                  {msg}
                </p>
              ))}
            </fieldset>

            {/* SCRUM-171 AC1, AC3: an optional note; a request made before
                Registration needed existed keeps its answer here. */}
            <div className="space-y-2">
              <Label htmlFor="registrationNotes">
                Registration Notes (Optional)
              </Label>
              <Textarea
                id="registrationNotes"
                placeholder="Anything else about registration (e.g., open to the public, check-in desks)..."
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
            <h3 className="flex items-center gap-2 text-base font-semibold">
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
                    <span className="font-semibold">Date:</span>{" "}
                    {reviewPeriod.startAt ? (
                      formatDate(reviewPeriod.startAt)
                    ) : (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                        Missing (Required to Submit)
                      </span>
                    )}
                  </p>
                  <p>
                    <span className="font-semibold">Time:</span>{" "}
                    {reviewPeriod.startAt && reviewPeriod.endAt ? (
                      `${formatTime(reviewPeriod.startAt)} – ${formatTime(reviewPeriod.endAt)}`
                    ) : (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                        Missing (Required to Submit)
                      </span>
                    )}
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
                    <span className="font-semibold">Registration Needed:</span>
                    <p className="text-muted-foreground">
                      {formData.registrationRequired === "yes" ? (
                        "Yes"
                      ) : formData.registrationRequired === "no" ? (
                        "No"
                      ) : (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                          Missing (Required to Submit)
                        </span>
                      )}
                    </p>
                    <span className="font-semibold">Registration Notes:</span>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {formData.registrationNotes.trim() || "None"}
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

        <ActionError message={formError} />
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
                className="gap-1.5"
                disabled={isPending}
                onClick={handleSaveDraft}
                data-saved={justSaved || undefined}
              >
                {justSaved ? (
                  <>
                    <Check className="h-4 w-4 text-success" /> Saved as draft
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {savingDraft ? "Saving…" : "Save as Draft"}
                  </>
                )}
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
        <DialogFooter>
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
