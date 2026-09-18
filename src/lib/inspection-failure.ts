/**
 * Standard rejection / failure reasons when an inspection fails verification.
 * Legal Metrology Act & OIML R76 compliant.
 */

export interface FailureReasonDef {
  id: string;
  label: string;
  category: "CALIBRATION" | "INTEGRITY" | "HARDWARE" | "COMPLIANCE";
}

export const FAILURE_REASONS: FailureReasonDef[] = [
  { id: "EXCEEDS_MPE", label: "Measurement error exceeds MPE tolerance", category: "CALIBRATION" },
  { id: "SEAL_TAMPERED", label: "Physical seal broken, missing or tampered", category: "INTEGRITY" },
  { id: "DISPLAY_ILLEGIBLE", label: "Digital display / graduation markings illegible", category: "HARDWARE" },
  { id: "PLATE_DEFACED", label: "Data plate missing, defaced or altered", category: "COMPLIANCE" },
  { id: "MECHANICAL_FRICTION", label: "Mechanical binding, friction or zero drift", category: "HARDWARE" },
  { id: "NON_STANDARD_WEIGHTS", label: "Non-standard or counterfeit test weights / measures", category: "COMPLIANCE" },
  { id: "ENVIRONMENT_UNSUITABLE", label: "Operating environment unsuitable (vibration/draft)", category: "INTEGRITY" },
  { id: "OTHER", label: "Other regulatory non-compliance", category: "COMPLIANCE" },
];

/** Combines structured rejection reasons and custom text into a single note string. */
export function formatFailureNote(reasonIds: string[], customNotes: string): string {
  const selectedLabels = reasonIds
    .map((id) => FAILURE_REASONS.find((r) => r.id === id)?.label)
    .filter(Boolean);

  if (selectedLabels.length === 0) return customNotes.trim();

  const prefix = `[Rejection reasons: ${selectedLabels.join("; ")}]`;
  const extra = customNotes.trim();
  return extra ? `${prefix} ${extra}` : prefix;
}

/** Extracts structured rejection reasons and custom user notes from an inspection note. */
export function parseFailureReasons(notes?: string | null): { reasons: string[]; userNote: string } {
  if (!notes) return { reasons: [], userNote: "" };
  const match = /^\[Rejection reasons: ([\s\S]*?)\](?:\s+([\s\S]*))?$/.exec(notes.trim());
  if (match) {
    const reasons = match[1].split("; ").map((s) => s.trim());
    const userNote = match[2] ? match[2].trim() : "";
    return { reasons, userNote };
  }
  return { reasons: [], userNote: notes };
}

