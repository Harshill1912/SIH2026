"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Landmark,
  ShieldCheck,
  Clock,
  CheckCircle2,
  RefreshCw,
  UserCheck,
  Inbox,
  ListFilter,
  Camera,
  MapPin,
  CalendarClock,
  FlaskConical,
} from "lucide-react";
import EvidenceModal, { type EvidenceInspection } from "./EvidenceModal";
import AssignModal, { type AssignInitial, type Centre, type Officer } from "./AssignModal";
import ExpiryAlerts from "@/components/alerts/ExpiryAlerts";
import PendencyBar from "./PendencyBar";
import ReportsQueue from "./ReportsQueue";
import RiskPanel from "./RiskPanel";
import RevokeButton from "./RevokeButton";
import ScheduleChip from "@/components/ScheduleChip";
import { useNow } from "@/hooks/useNow";
import { nextWorkingDay, scheduleStatus, slotOf, toDateInputValue } from "@/lib/schedule";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconButton,
  LoadingState,
  Mono,
  Notice,
  PageHeader,
  Segmented,
  StatTile,
  cx,
} from "@/components/ui";

interface ApplicationRecord {
  id: string;
  applicationNumber: string;
  status: "SUBMITTED" | "ASSIGNED" | "INSPECTED" | "REJECTED";
  createdAt: string;
  scheduledFor: string | null;
  business: { id: string; name: string; regNo: string; contact: string };
  instrument: {
    id: string;
    serialNumber: string;
    category: string;
    model: string;
    capacity: string;
    location: string;
  };
  assignedOfficer: { id: string; name: string; badgeNumber: string } | null;
  assignedCentre: { id: string; name: string; notifyNo: string } | null;
  inspection: EvidenceInspection | null;
  certificate: { id: string; certNumber: string; revokedAt: string | null } | null;
}

type Filter = "ALL" | "SUBMITTED" | "ASSIGNED" | "INSPECTED";

interface AssignTarget {
  app: ApplicationRecord;
  mode: "assign" | "reschedule";
  initial: AssignInitial;
  minDate: string;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/* Pure fetchers — no component state, so callers decide how to apply them. */
async function loadOfficers(): Promise<Officer[] | null> {
  try {
    const res = await fetch("/api/officers");
    const data = await res.json();
    return data.success ? data.officers : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

async function loadCentres(): Promise<Centre[] | null> {
  try {
    const res = await fetch("/api/centres");
    const data = await res.json();
    return data.success ? data.centres : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

async function loadApplications(): Promise<ApplicationRecord[] | null> {
  try {
    const res = await fetch("/api/applications");
    const data = await res.json();
    return data.success ? data.applications : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export default function AdminDashboard() {
  const now = useNow();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Filter>("ALL");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [evidenceFor, setEvidenceFor] = useState<ApplicationRecord | null>(null);
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [assigning, setAssigning] = useState(false);

  const applyApplications = useCallback((list: ApplicationRecord[] | null) => {
    if (list) setApplications(list);
    setLoading(false);
  }, []);

  /** Silent reload — keeps the queue on screen while fresh rows arrive. */
  const fetchApplications = useCallback(
    () => loadApplications().then(applyApplications),
    [applyApplications]
  );

  /** Manual refresh — shows the loading state so the click visibly did something. */
  const refresh = useCallback(() => {
    setLoading(true);
    void fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    let alive = true;
    loadOfficers().then((o) => alive && o && setOfficers(o));
    loadCentres().then((c) => alive && c && setCentres(c));
    loadApplications().then((a) => alive && applyApplications(a));
    return () => {
      alive = false;
    };
  }, [applyApplications]);

  /** Open the assign/reschedule dialog. Defaults to the next working day, morning. */
  const openAssign = (app: ApplicationRecord) => {
    const today = new Date();
    const existing = app.scheduledFor ? new Date(app.scheduledFor) : null;
    const base = existing ?? nextWorkingDay(today);
    setAssignTarget({
      app,
      mode: app.status === "SUBMITTED" ? "assign" : "reschedule",
      initial: {
        kind: app.assignedCentre ? "GATC" : "OFFICER",
        officerId: app.assignedOfficer?.id ?? officers[0]?.id ?? "",
        centreId: app.assignedCentre?.id ?? centres[0]?.id ?? "",
        date: toDateInputValue(base),
        slot: existing ? slotOf(existing) : "AM",
      },
      minDate: toDateInputValue(today),
    });
  };

  const handleAssign = async (v: { officerId?: string; centreId?: string; scheduledFor: string }) => {
    if (!assignTarget) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: assignTarget.app.id,
          ...(v.centreId ? { assignedCentreId: v.centreId } : { assignedOfficerId: v.officerId }),
          scheduledFor: v.scheduledFor,
          status: "ASSIGNED",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message);
        setTimeout(() => setActionMessage(null), 4000);
        setAssignTarget(null);
        fetchApplications();
      } else {
        alert(data.error || "Failed to assign");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAssigning(false);
    }
  };

  const pending = applications.filter((a) => a.status === "SUBMITTED");
  const assigned = applications.filter((a) => a.status === "ASSIGNED");
  const completed = applications.filter((a) => a.status === "INSPECTED" || a.certificate !== null);
  const visitsToday = now
    ? assigned.filter((a) => a.scheduledFor && scheduleStatus(a.scheduledFor, now) === "today").length
    : 0;

  const visible =
    statusFilter === "ALL" ? applications : applications.filter((a) => a.status === statusFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin HQ"
        title="Assignment desk"
        meta={
          <>
            <span>Legal Metrology Department</span>
            <span className="text-ink-300">·</span>
            <span>Officer dispatch &amp; inspection oversight</span>
          </>
        }
        actions={<IconButton icon={RefreshCw} label="Refresh queue" spinning={loading} onClick={refresh} />}
      />

      {actionMessage && (
        <Notice tone="good" icon={CheckCircle2}>
          {actionMessage}
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Applications" value={applications.length} hint="total filed" icon={Landmark} />
        <StatTile
          label="Awaiting officer"
          value={pending.length}
          hint="needs assignment"
          tone="warn"
          icon={Clock}
          emphasis={pending.length > 0}
        />
        <StatTile
          label="In the field"
          value={assigned.length}
          hint={visitsToday > 0 ? `${visitsToday} visit${visitsToday === 1 ? "" : "s"} today` : "scheduled"}
          tone="info"
          icon={ShieldCheck}
        />
        <StatTile label="Certified" value={completed.length} hint="inspected" tone="good" icon={CheckCircle2} emphasis />
      </div>

      <PendencyBar items={pending} now={now} />

      <RiskPanel />

      <ExpiryAlerts scope="admin" />

      <ReportsQueue />

      <Card className="overflow-hidden">
        <CardHeader
          icon={ListFilter}
          title="Application queue"
          subtitle={
            pending.length > 0
              ? `${pending.length} application${pending.length === 1 ? "" : "s"} waiting for an officer`
              : "Every application has an officer"
          }
          actions={
            <Segmented<Filter>
              size="sm"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "ALL", label: "All" },
                { value: "SUBMITTED", label: `Needs officer${pending.length ? ` · ${pending.length}` : ""}` },
                { value: "ASSIGNED", label: "Assigned" },
                { value: "INSPECTED", label: "Inspected" },
              ]}
            />
          }
        />

        {loading ? (
          <LoadingState label="Loading applications" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nothing in this queue"
            body="Applications appear here as soon as a business applies for verification."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Business</th>
                  <th>Instrument</th>
                  <th>Status</th>
                  <th>Field officer &amp; visit</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((app) => {
                  const needsOfficer = app.status === "SUBMITTED";
                  return (
                    <tr key={app.id} className={cx(needsOfficer && "bg-amber-50/30")}>
                      <td>
                        <Mono chip className="font-semibold">{app.applicationNumber}</Mono>
                        <div className="mt-1.5 text-xs text-ink-500">Filed {fmtDate(app.createdAt)}</div>
                      </td>
                      <td>
                        <div className="font-medium text-ink-900">{app.business.name}</div>
                        <div className="mt-0.5 font-mono text-xs text-ink-500">{app.business.regNo}</div>
                      </td>
                      <td>
                        <Mono className="font-semibold text-ink-900">{app.instrument.serialNumber}</Mono>
                        <div className="mt-0.5 text-[13px] text-ink-600">{app.instrument.category}</div>
                        <div className="text-xs text-ink-400">{app.instrument.location}</div>
                      </td>
                      <td>
                        {app.status === "SUBMITTED" && (
                          <Badge tone="warn" dot pulse>
                            Needs officer
                          </Badge>
                        )}
                        {app.status === "ASSIGNED" && (
                          <Badge tone="info" dot>
                            In the field
                          </Badge>
                        )}
                        {app.status === "INSPECTED" && (
                          <Badge
                            tone={
                              app.certificate?.revokedAt
                                ? "bad"
                                : app.inspection?.result === "FAIL"
                                  ? "bad"
                                  : "good"
                            }
                            dot
                          >
                            {app.certificate?.revokedAt
                              ? "Revoked"
                              : app.inspection?.result === "FAIL"
                                ? "Failed inspection"
                                : "Certified"}
                          </Badge>
                        )}
                        {app.status === "REJECTED" && (
                          <Badge tone="bad" dot>
                            Rejected
                          </Badge>
                        )}
                      </td>
                      <td>
                        {needsOfficer ? (
                          <Button
                            size="sm"
                            variant="accent"
                            icon={UserCheck}
                            onClick={() => openAssign(app)}
                            disabled={officers.length === 0 && centres.length === 0}
                          >
                            Assign &amp; schedule
                          </Button>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-medium text-ink-900">
                                {app.assignedCentre && <FlaskConical className="h-3.5 w-3.5 shrink-0 text-ink-400" />}
                                {app.assignedCentre?.name ?? app.assignedOfficer?.name ?? "—"}
                              </div>
                              <div className="mt-0.5 font-mono text-xs text-ink-500">
                                {app.assignedCentre?.notifyNo ?? app.assignedOfficer?.badgeNumber ?? ""}
                              </div>
                              {app.status === "ASSIGNED" && (
                                <ScheduleChip iso={app.scheduledFor} now={now} muted className="mt-1.5" />
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {app.status === "ASSIGNED" && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  icon={CalendarClock}
                                  onClick={() => openAssign(app)}
                                  title="Change officer or visit date"
                                >
                                  Reschedule
                                </Button>
                              )}
                              {app.inspection && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  icon={app.inspection.photoAttached ? Camera : MapPin}
                                  onClick={() => setEvidenceFor(app)}
                                  title="View inspection evidence"
                                >
                                  Evidence
                                </Button>
                              )}
                              {app.certificate && (
                                <RevokeButton
                                  certificateId={app.certificate.id}
                                  certNumber={app.certificate.certNumber}
                                  revokedAt={app.certificate.revokedAt}
                                  onDone={fetchApplications}
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {assignTarget && (
        <AssignModal
          key={assignTarget.app.id}
          open
          onClose={() => setAssignTarget(null)}
          mode={assignTarget.mode}
          officers={officers}
          centres={centres}
          summary={{
            applicationNumber: assignTarget.app.applicationNumber,
            businessName: assignTarget.app.business.name,
            serialNumber: assignTarget.app.instrument.serialNumber,
            location: assignTarget.app.instrument.location,
            category: assignTarget.app.instrument.category,
          }}
          initial={assignTarget.initial}
          minDate={assignTarget.minDate}
          busy={assigning}
          onConfirm={handleAssign}
        />
      )}

      <EvidenceModal
        open={Boolean(evidenceFor)}
        onClose={() => setEvidenceFor(null)}
        inspection={evidenceFor?.inspection ?? null}
        applicationNumber={evidenceFor?.applicationNumber}
        serialNumber={evidenceFor?.instrument.serialNumber}
        officerName={evidenceFor?.assignedCentre?.name ?? evidenceFor?.assignedOfficer?.name}
      />
    </div>
  );
}
