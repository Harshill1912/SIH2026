"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
  UploadCloud,
  FileCheck,
  Scale,
  ArrowRight,
  ClipboardList,
  History,
  Search,
  Camera,
  QrCode,
  Printer,
  MapPin,
} from "lucide-react";
import CertificateModal from "@/components/certificate/CertificateModal";
import EvidenceModal, { type EvidenceInspection } from "@/components/admin/EvidenceModal";
import GeoCapture from "./GeoCapture";
import PhotoCapture, { type PhotoValue } from "./PhotoCapture";
import TestWeights from "./TestWeights";
import { divisionFromCapacity, evaluateAll, verdictFor, type TestWeightRow } from "@/lib/mpe";
import { useRole } from "@/context/RoleContext";
import { useNow } from "@/hooks/useNow";
import ScheduleChip from "@/components/ScheduleChip";
import { formatGeo, type GeoFix } from "@/lib/geo";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconButton,
  KV,
  Label,
  LoadingState,
  Mono,
  Notice,
  PageHeader,
  Segmented,
  StatTile,
  cx,
} from "@/components/ui";

/** What the API expects for one inspection. Also what we queue offline. */
interface InspectionPayload {
  applicationId: string;
  result: "PASS" | "FAIL";
  notes: string;
  photoAttached: boolean;
  photoData: string | null;
  photoName: string | null;
  /** JSON array of evaluated calibration rows; "" when none were entered. */
  testWeights: string;
  mpeVerdict: "PASS" | "FAIL" | null;
  gpsCoordinates: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracyM: number | null;
}

interface QueuedInspection extends InspectionPayload {
  id: string;
  appNumber: string;
  serialNumber: string;
  queuedAt: string;
}

interface OfficerApplicationRecord {
  id: string;
  applicationNumber: string;
  status: string;
  createdAt: string;
  scheduledFor: string | null;
  business: { id: string; name: string; address: string; contact: string };
  instrument: {
    id: string;
    serialNumber: string;
    category: string;
    model: string;
    capacity: string;
    location: string;
  };
  inspection?: EvidenceInspection | null;
  certificate?: {
    id: string;
    certNumber: string;
    token: string;
    qrCode: string;
    validFrom: string;
    validTill: string;
  } | null;
}

const QUEUE_KEY = "sih_offline_inspections";

function readOfflineQueue(): QueuedInspection[] {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? (JSON.parse(stored) as QueuedInspection[]) : [];
  } catch (e) {
    console.error("Failed to parse offline queue:", e);
    return [];
  }
}

/** Pure fetch — the server scopes it to the signed-in officer. */
async function loadOfficerApplications(): Promise<OfficerApplicationRecord[] | null> {
  try {
    const res = await fetch("/api/applications");
    const data = await res.json();
    return data.success ? data.applications : null;
  } catch (e) {
    console.error("Failed to fetch cases:", e);
    return null;
  }
}

async function postInspection(payload: InspectionPayload) {
  const res = await fetch("/api/inspections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export default function OfficerFieldView() {
  const router = useRouter();
  const { user, roleInfo } = useRole();
  const isCentre = user?.role === "GATC";
  const now = useNow();
  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");
  const [historySearch, setHistorySearch] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<QueuedInspection[]>([]);
  const [cases, setCases] = useState<OfficerApplicationRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<OfficerApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Modal inspection evidence & certificate states
  const [evidenceTarget, setEvidenceTarget] = useState<{
    inspection: EvidenceInspection;
    appNumber: string;
    serialNumber: string;
  } | null>(null);

  // Form state. The geotag lives here (not in the per-case form) so one fix
  // carries across several cases at the same shop.
  const [result, setResult] = useState<"PASS" | "FAIL">("PASS");
  const [notes, setNotes] = useState(
    "Standard calibration test performed with certified reference weights. Government verification seal affixed after test."
  );
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [photo, setPhoto] = useState<PhotoValue | null>(null);
  const [weights, setWeights] = useState<TestWeightRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const [issuedCertificate, setIssuedCertificate] = useState<{
    certNumber: string;
    token: string;
    qrCode: string;
    validFrom: string;
    validTill: string;
  } | null>(null);

  const selectedCase = cases.find((c) => c.id === selectedId) ?? null;

  const applyApplications = useCallback((list: OfficerApplicationRecord[] | null) => {
    if (list) {
      const active = list.filter((a) => a.status === "ASSIGNED");
      const past = list.filter((a) => a.status === "INSPECTED" || a.status === "VERIFIED" || a.inspection != null);

      // Earliest visit first; unscheduled cases sink to the bottom.
      const sortedActive = [...active].sort((a, b) =>
        (a.scheduledFor ?? "9999").localeCompare(b.scheduledFor ?? "9999")
      );
      setCases(sortedActive);
      setHistoryRecords(past);

      // Keep the current selection if it still exists; otherwise pick the first case.
      setSelectedId((prev) => (prev && sortedActive.some((c) => c.id === prev) ? prev : sortedActive[0]?.id ?? null));
    }
    setLoading(false);
  }, []);

  /** Silent reload — keeps the queue on screen while fresh rows arrive. */
  const fetchApplications = useCallback(() => loadOfficerApplications().then(applyApplications), [applyApplications]);

  /** Manual refresh — shows the loading state so the click visibly did something. */
  const refresh = useCallback(() => {
    setLoading(true);
    void fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    let alive = true;
    loadOfficerApplications().then((list) => alive && applyApplications(list));
    // The offline queue is device state: read it after mount so the server
    // and client render the same first frame.
    const id = window.setTimeout(() => alive && setOfflineQueue(readOfflineQueue()), 0);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [applyApplications]);

  const flash = (msg: string, ms = 3500) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), ms);
  };

  const selectCase = (id: string) => {
    setSelectedId(id);
    // Evidence is per case; the geotag is not, since one fix covers a whole shop.
    setPhoto(null);
    setWeights([]);
  };

  const buildPayload = (applicationId: string): InspectionPayload => {
    const divisionG = selectedCase ? divisionFromCapacity(selectedCase.instrument.capacity) : null;
    const evaluated = divisionG != null ? evaluateAll(weights, divisionG) : [];
    return {
    applicationId,
    result,
    notes,
    testWeights: evaluated.length > 0 ? JSON.stringify(evaluated) : "",
    mpeVerdict: verdictFor(evaluated),
    photoAttached: Boolean(photo),
    photoData: photo?.dataUrl ?? null,
    photoName: photo?.name ?? null,
    gpsCoordinates: geo ? formatGeo(geo) : null,
    gpsLat: geo?.lat ?? null,
    gpsLng: geo?.lng ?? null,
    gpsAccuracyM: geo?.accuracyM ?? null,
    };
  };

  const handleSync = async () => {
    if (offlineQueue.length === 0) return;
    setSyncing(true);
    let synced = 0;
    try {
      for (const item of offlineQueue) {
        const data = await postInspection(item);
        if (data.success) {
          synced++;
          if (data.certificate) setIssuedCertificate(data.certificate);
        }
      }
      localStorage.removeItem(QUEUE_KEY);
      setOfflineQueue([]);
      flash(`Synced ${synced} queued inspection${synced === 1 ? "" : "s"}.`);
      fetchApplications();
    } catch (e) {
      console.error("Sync error:", e);
      alert("Failed to complete sync. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !geo) return;
    const payload = buildPayload(selectedCase.id);

    if (isOffline) {
      const queued: QueuedInspection = {
        ...payload,
        id: "offline-" + Date.now(),
        appNumber: selectedCase.applicationNumber,
        serialNumber: selectedCase.instrument.serialNumber,
        queuedAt: new Date().toLocaleTimeString(),
      };
      const updated = [...offlineQueue, queued];
      try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
      } catch {
        alert("This device is out of local storage — remove the photo and try again.");
        return;
      }
      setOfflineQueue(updated);
      setCases((prev) => prev.filter((c) => c.id !== selectedCase.id));
      setSelectedId(null);
      setPhoto(null);
      setWeights([]);
      flash("Saved on this device. Go online and press Sync to upload.", 4000);
      return;
    }

    setSubmitting(true);
    try {
      const data = await postInspection(payload);
      if (data.success) {
        if (data.certificate) setIssuedCertificate(data.certificate);
        else flash(`Inspection recorded · ${result}`);
        setSelectedId(null);
        setPhoto(null);
        setWeights([]);
        fetchApplications();
      } else {
        alert(data.error || "Failed to record inspection");
      }
    } catch (e) {
      console.error(e);
      alert("Network error recording inspection");
    } finally {
      setSubmitting(false);
    }
  };

  const q = historySearch.trim().toLowerCase();
  const filteredHistory = q
    ? historyRecords.filter(
        (rec) =>
          rec.applicationNumber.toLowerCase().includes(q) ||
          rec.business.name.toLowerCase().includes(q) ||
          rec.instrument.serialNumber.toLowerCase().includes(q) ||
          rec.instrument.category.toLowerCase().includes(q) ||
          rec.instrument.model.toLowerCase().includes(q) ||
          (rec.certificate?.certNumber && rec.certificate.certNumber.toLowerCase().includes(q))
      )
    : historyRecords;

  const passedCount = historyRecords.filter((r) => r.inspection?.result === "PASS").length;
  const failedCount = historyRecords.filter((r) => r.inspection?.result === "FAIL").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isCentre ? "Government Approved Test Centre" : "Field officer"}
        title={roleInfo.name}
        meta={
          <>
            {user?.badgeNumber && <Mono chip>{user.badgeNumber}</Mono>}
            <span>
              Delhi jurisdiction ·{" "}
              {isCentre ? "Notified under the Legal Metrology Act" : "Legal Metrology Department"}
            </span>
          </>
        }
        actions={
          <>
            <Segmented<"online" | "offline">
              value={isOffline ? "offline" : "online"}
              onChange={(v) => setIsOffline(v === "offline")}
              options={[
                { value: "online", label: "Online", icon: Wifi, activeClass: "text-seal-700" },
                { value: "offline", label: "Offline", icon: WifiOff, activeClass: "!bg-amber-500 !text-white" },
              ]}
            />
            <IconButton icon={RefreshCw} label="Refresh applications" spinning={loading} onClick={refresh} />
          </>
        }
      />

      {/* Tabs: Active queue vs Past inspection history */}
      <div className="flex items-center justify-between border-b border-line pb-1">
        <Segmented<"queue" | "history">
          value={activeTab}
          onChange={setActiveTab}
          options={[
            {
              value: "queue",
              label: (
                <span className="inline-flex items-center gap-2">
                  <span>Assigned Queue</span>
                  <Badge tone={cases.length > 0 ? "good" : "neutral"} className="px-1.5 py-0 text-[11px]">
                    {cases.length}
                  </Badge>
                </span>
              ),
              icon: ClipboardList,
            },
            {
              value: "history",
              label: (
                <span className="inline-flex items-center gap-2">
                  <span>Past Inspections</span>
                  <Badge tone="neutral" className="px-1.5 py-0 text-[11px]">
                    {historyRecords.length}
                  </Badge>
                </span>
              ),
              icon: History,
            },
          ]}
        />
      </div>

      {offlineQueue.length > 0 && (
        <Notice
          tone="warn"
          icon={UploadCloud}
          action={
            !isOffline && (
              <Button variant="warn" size="sm" iconRight={ArrowRight} loading={syncing} onClick={handleSync}>
                Sync {offlineQueue.length} to server
              </Button>
            )
          }
        >
          <span className="font-medium">
            {offlineQueue.length} inspection{offlineQueue.length === 1 ? "" : "s"} waiting on this device.
          </span>{" "}
          <span className="text-amber-800">
            {isOffline ? "Switch to Online to upload." : "Connection restored — ready to upload."}
          </span>
        </Notice>
      )}

      {statusNotification && (
        <Notice tone="good" icon={CheckCircle2}>
          {statusNotification}
        </Notice>
      )}

      {activeTab === "history" ? (
        /* Past Inspection History View */
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile label="Total Inspected" value={historyRecords.length} hint="cases completed" icon={ClipboardList} />
            <StatTile
              label="Passed & Certified"
              value={passedCount}
              hint="within OIML R76 MPE"
              tone="good"
              icon={CheckCircle2}
              emphasis={passedCount > 0}
            />
            <StatTile
              label="Failed / Rejected"
              value={failedCount}
              hint="tolerance exceeded"
              tone="bad"
              icon={XCircle}
              emphasis={failedCount > 0}
            />
          </div>

          <Card className="overflow-hidden">
            <CardHeader
              icon={History}
              title={
                <>
                  Inspection History{" "}
                  <span className="ml-1 font-normal text-ink-400 tnum">{filteredHistory.length}</span>
                </>
              }
              actions={
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    type="search"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search serial, trader, app #…"
                    className="field h-9 py-0 pl-9 text-[13px]"
                  />
                </div>
              }
            />

            {loading ? (
              <LoadingState label="Loading past inspections" />
            ) : filteredHistory.length === 0 ? (
              <EmptyState
                icon={History}
                title={q ? "No matching inspections" : "No past inspections yet"}
                body={
                  q
                    ? "Try searching for a different application number, serial, or trader name."
                    : "Completed on-site inspections will appear here with full calibration records, test readings, and certificates."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-clean">
                  <thead>
                    <tr>
                      <th>Application &amp; Date</th>
                      <th>Trader &amp; Location</th>
                      <th>Instrument</th>
                      <th>Result &amp; MPE</th>
                      <th>Certificate</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((rec) => {
                      const insp = rec.inspection;
                      const cert = rec.certificate;
                      const isPass = insp?.result === "PASS";
                      return (
                        <tr key={rec.id}>
                          <td>
                            <Mono chip className="font-semibold">{rec.applicationNumber}</Mono>
                            <div className="mt-1 text-xs text-ink-500">
                              {insp?.inspectedAt
                                ? new Date(insp.inspectedAt).toLocaleString("en-IN", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })
                                : new Date(rec.createdAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                            </div>
                          </td>
                          <td>
                            <div className="font-medium text-ink-900">{rec.business.name}</div>
                            <div className="mt-0.5 max-w-xs truncate text-xs text-ink-500">
                              {rec.business.address}
                            </div>
                            {insp?.gpsCoordinates && (
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{insp.gpsCoordinates}</span>
                              </div>
                            )}
                          </td>
                          <td>
                            <Mono className="font-medium text-ink-900">{rec.instrument.serialNumber}</Mono>
                            <div className="mt-0.5 text-xs text-ink-600">{rec.instrument.category}</div>
                            <div className="font-mono text-[11px] text-ink-400">{rec.instrument.capacity}</div>
                          </td>
                          <td>
                            <div className="flex flex-col items-start gap-1">
                              <Badge tone={isPass ? "good" : "bad"} dot>
                                {isPass ? "PASS" : "FAIL"}
                              </Badge>
                              {insp?.mpeVerdict && (
                                <span className="text-[11px] text-ink-500">
                                  {insp.mpeVerdict === "PASS" ? "Within tolerance" : "MPE exceeded"}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {cert ? (
                              <div>
                                <Mono className="font-semibold text-seal-800">{cert.certNumber}</Mono>
                                <div className="mt-0.5 text-[11px] text-ink-500">
                                  Valid till{" "}
                                  {new Date(cert.validTill).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-ink-400">—</span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-1.5">
                              {insp && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  icon={Camera}
                                  onClick={() =>
                                    setEvidenceTarget({
                                      inspection: insp,
                                      appNumber: rec.applicationNumber,
                                      serialNumber: rec.instrument.serialNumber,
                                    })
                                  }
                                >
                                  Evidence
                                </Button>
                              )}
                              {cert && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    icon={QrCode}
                                    onClick={() => router.push(`/verify/${cert.token}`)}
                                  >
                                    Certificate
                                  </Button>
                                  <IconButton
                                    icon={Printer}
                                    label="Print sticker sheet"
                                    onClick={() => router.push(`/sticker/${cert.token}`)}
                                  />
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : (
        /* Active Inspection Queue & Workspace */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Queue */}
          <Card className="overflow-hidden lg:col-span-5">
            <CardHeader
              icon={ClipboardList}
              title="Assigned cases"
              actions={<Badge tone="neutral">{cases.length} open</Badge>}
            />
            {loading ? (
              <LoadingState label="Loading assigned cases" />
            ) : cases.length === 0 ? (
              <EmptyState
                compact
                icon={Scale}
                title="No pending inspections"
                body="Every assigned instrument has been verified. Admin HQ can dispatch more cases."
              />
            ) : (
              <ul className="divide-y divide-line">
                {cases.map((c) => {
                  const active = selectedId === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => selectCase(c.id)}
                        className={cx(
                          "relative flex w-full flex-col gap-2 px-5 py-4 text-left transition-colors focus-ring",
                          active ? "bg-seal-50/60" : "hover:bg-ink-50"
                        )}
                      >
                        {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-seal-600" />}
                        <div className="flex items-center justify-between gap-3">
                          <Mono chip className="font-semibold">{c.applicationNumber}</Mono>
                          <Badge tone={active ? "good" : "neutral"} dot={active}>
                            {active ? "Inspecting" : "Ready"}
                          </Badge>
                        </div>
                        <div>
                          <div className="text-[15px] font-medium text-ink-900">{c.business.name}</div>
                          <div className="truncate text-[13px] text-ink-500">{c.business.address}</div>
                        </div>
                        <div className="flex items-center justify-between text-[13px]">
                          <Mono className="text-ink-700">{c.instrument.serialNumber}</Mono>
                          <span className="text-ink-500">{c.instrument.category}</span>
                        </div>
                        <ScheduleChip iso={c.scheduledFor} now={now} muted />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Workspace */}
          <div className="lg:col-span-7">
            {selectedCase ? (
              <form key={selectedCase.id} onSubmit={handleSubmitInspection} className="card animate-fade-up">
                <CardHeader
                  title="Field verification"
                  subtitle={
                    <>
                      Case <Mono>{selectedCase.applicationNumber}</Mono>
                    </>
                  }
                  actions={
                    <>
                      <ScheduleChip iso={selectedCase.scheduledFor} now={now} />
                      <Mono chip className="font-semibold">{selectedCase.instrument.serialNumber}</Mono>
                    </>
                  }
                />

                <div className="space-y-6 px-5 py-5">
                  <div className="grid grid-cols-2 gap-4 rounded-xl border border-line bg-ink-50/60 p-4 sm:grid-cols-4">
                    <KV label="Applicant" value={selectedCase.business.name} />
                    <KV label="Category" value={selectedCase.instrument.category} />
                    <KV label="Make / model" value={selectedCase.instrument.model} />
                    <KV label="Capacity" value={selectedCase.instrument.capacity} mono />
                  </div>

                  <TestWeights
                    capacity={selectedCase.instrument.capacity}
                    rows={weights}
                    onChange={setWeights}
                  />

                  {/* Outcome */}
                  <div>
                    <Label>Inspection outcome</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setResult("PASS")}
                        aria-pressed={result === "PASS"}
                        className={cx(
                          "flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-150 focus-ring",
                          result === "PASS"
                            ? "border-seal-600 bg-seal-600 text-white shadow-lift"
                            : "border-line-strong bg-white text-ink-800 hover:border-seal-300 hover:bg-seal-50/40"
                        )}
                      >
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                        <span>
                          <span className="block text-[15px] font-semibold">Pass</span>
                          <span className={cx("block text-xs", result === "PASS" ? "text-seal-100" : "text-ink-500")}>
                            Issue signed certificate
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setResult("FAIL")}
                        aria-pressed={result === "FAIL"}
                        className={cx(
                          "flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-150 focus-ring",
                          result === "FAIL"
                            ? "border-rose-600 bg-rose-600 text-white shadow-lift"
                            : "border-line-strong bg-white text-ink-800 hover:border-rose-300 hover:bg-rose-50/40"
                        )}
                      >
                        <XCircle className="h-5 w-5 shrink-0" />
                        <span>
                          <span className="block text-[15px] font-semibold">Fail</span>
                          <span className={cx("block text-xs", result === "FAIL" ? "text-rose-100" : "text-ink-500")}>
                            Reject calibration
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>

                  <GeoCapture value={geo} onChange={setGeo} />

                  <PhotoCapture value={photo} onChange={setPhoto} />

                  {/* Notes */}
                  <div>
                    <Label htmlFor="notes">Calibration notes</Label>
                    <textarea
                      id="notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="field resize-y text-[13px] leading-relaxed"
                    />
                  </div>

                  <div>
                    <Button
                      type="submit"
                      size="lg"
                      variant={isOffline ? "warn" : result === "FAIL" ? "danger" : "primary"}
                      icon={isOffline ? UploadCloud : FileCheck}
                      loading={submitting}
                      disabled={!geo}
                      className="w-full"
                    >
                      {isOffline
                        ? `Save offline · ${result}`
                        : result === "PASS"
                          ? "Submit & issue signed certificate"
                          : "Submit failed inspection"}
                    </Button>
                    {!geo && (
                      <p className="mt-2 text-center text-xs text-ink-500">
                        A geotag is required before an inspection can be recorded.
                      </p>
                    )}
                  </div>
                </div>
              </form>
            ) : (
              <Card className="h-full">
                <EmptyState
                  icon={ShieldCheck}
                  title="Select a case to inspect"
                  body="Pick an assigned case from the queue to record the on-site verification and issue the certificate."
                />
              </Card>
            )}
          </div>
        </div>
      )}

      {evidenceTarget && (
        <EvidenceModal
          open={Boolean(evidenceTarget)}
          onClose={() => setEvidenceTarget(null)}
          inspection={evidenceTarget.inspection}
          applicationNumber={evidenceTarget.appNumber}
          officerName={roleInfo.name}
          serialNumber={evidenceTarget.serialNumber}
        />
      )}

      <CertificateModal
        isOpen={Boolean(issuedCertificate)}
        onClose={() => setIssuedCertificate(null)}
        certificate={issuedCertificate}
      />
    </div>
  );
}
