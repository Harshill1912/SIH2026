"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Scale,
  Plus,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  QrCode,
  ArrowUpRight,
  Search,
  MapPin,
  Phone,
  Trash2,
} from "lucide-react";
import RegisterInstrumentModal from "./RegisterInstrumentModal";
import ExpiryAlerts from "@/components/alerts/ExpiryAlerts";
import ScheduleChip from "@/components/ScheduleChip";
import { useNow } from "@/hooks/useNow";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconButton,
  LoadingState,
  Modal,
  Mono,
  Notice,
  PageHeader,
  StatTile,
  type Tone,
} from "@/components/ui";

interface InstrumentRecord {
  id: string;
  serialNumber: string;
  category: string;
  model: string;
  capacity: string;
  location: string;
  computedStatus: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "PENDING" | "UNVERIFIED";
  daysRemaining: number | null;
  latestCertificate: {
    id: string;
    certNumber: string;
    token: string;
    validFrom: string;
    validTill: string;
    qrCode: string;
  } | null;
  latestApplication: {
    id: string;
    applicationNumber: string;
    status: string;
    scheduledFor: string | null;
    assignedOfficer: { name: string; badgeNumber: string } | null;
  } | null;
  createdAt: string;
}

interface StatsData {
  total: number;
  valid: number;
  expiringSoon: number;
  expired: number;
  unverified: number;
}

interface BusinessInfo {
  id: string;
  name: string;
  regNo: string;
  address: string;
  contact: string;
  lat: number | null;
  lng: number | null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

type RegistryData = { business: BusinessInfo | null; instruments: InstrumentRecord[]; stats: StatsData };

/** Pure fetch — the server scopes it to the signed-in business. */
async function loadRegistry(): Promise<RegistryData | null> {
  try {
    const res = await fetch("/api/instruments");
    const data = await res.json();
    return data.success
      ? { business: data.business ?? null, instruments: data.instruments, stats: data.stats }
      : null;
  } catch (err) {
    console.error("Failed to load instruments:", err);
    return null;
  }
}

export default function BusinessDashboard() {
  const router = useRouter();
  const now = useNow();
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [instruments, setInstruments] = useState<InstrumentRecord[]>([]);
  const [stats, setStats] = useState<StatsData>({
    total: 0,
    valid: 0,
    expiringSoon: 0,
    expired: 0,
    unverified: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingInstrument, setDeletingInstrument] = useState<InstrumentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /** Bumped after any change the alerts panel should reflect (e.g. a renewal). */
  const [alertsVersion, setAlertsVersion] = useState(0);

  const applyRegistry = useCallback((d: RegistryData | null) => {
    if (d) {
      setBusiness(d.business);
      setInstruments(d.instruments);
      setStats(d.stats);
    }
    setLoading(false);
  }, []);

  /** Silent reload — keeps the table on screen while fresh rows arrive. */
  const fetchInstruments = useCallback(() => loadRegistry().then(applyRegistry), [applyRegistry]);

  /** Manual refresh — shows the loading state so the click visibly did something. */
  const refresh = useCallback(() => {
    setLoading(true);
    void fetchInstruments();
  }, [fetchInstruments]);

  useEffect(() => {
    let alive = true;
    loadRegistry().then((d) => alive && applyRegistry(d));
    return () => {
      alive = false;
    };
  }, [applyRegistry]);

  const handleApply = async (instrumentId: string) => {
    setApplyingId(instrumentId);
    setApplyMessage(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrumentId }),
      });
      const data = await res.json();
      if (data.success) {
        setApplyMessage(data.message);
        setTimeout(() => setApplyMessage(null), 3500);
        fetchInstruments();
        setAlertsVersion((v) => v + 1);
      } else {
        alert(data.error || "Failed to submit application");
      }
    } catch (e) {
      console.error(e);
      alert("Error submitting application");
    } finally {
      setApplyingId(null);
    }
  };

  const handleDeleteInstrument = async () => {
    if (!deletingInstrument) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/instruments?id=${encodeURIComponent(deletingInstrument.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeletingInstrument(null);
        setApplyMessage(`Instrument ${deletingInstrument.serialNumber} removed from registry`);
        setTimeout(() => setApplyMessage(null), 3500);
        fetchInstruments();
        setAlertsVersion((v) => v + 1);
      } else {
        setDeleteError(data.error || "Failed to delete instrument");
      }
    } catch {
      setDeleteError("Network error while deleting instrument");
    } finally {
      setDeleting(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredInstruments = q
    ? instruments.filter(
        (inst) =>
          inst.serialNumber.toLowerCase().includes(q) ||
          inst.category.toLowerCase().includes(q) ||
          inst.model.toLowerCase().includes(q)
      )
    : instruments;

  const statusBadge = (inst: InstrumentRecord) => {
    const map: Record<InstrumentRecord["computedStatus"], { tone: Tone; label: string; pulse?: boolean }> = {
      VALID: { tone: "good", label: `Valid · ${inst.daysRemaining}d left` },
      EXPIRING_SOON: { tone: "warn", label: `Expiring · ${inst.daysRemaining}d`, pulse: true },
      EXPIRED: { tone: "bad", label: "Expired" },
      PENDING: {
        tone: "info",
        label:
          inst.latestApplication?.status === "ASSIGNED" ? "Officer assigned" : "Application filed",
      },
      UNVERIFIED: { tone: "neutral", label: "Unverified" },
    };
    const s = map[inst.computedStatus];
    return (
      <Badge tone={s.tone} dot pulse={s.pulse}>
        {s.label}
      </Badge>
    );
  };

  const canApply = (inst: InstrumentRecord) =>
    !inst.latestApplication ||
    inst.latestApplication.status === "REJECTED" ||
    inst.computedStatus === "EXPIRED" ||
    inst.computedStatus === "UNVERIFIED";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Business portal"
        title={business?.name ?? <span className="text-ink-300">Loading…</span>}
        meta={
          business && (
            <>
              <Mono chip>{business.regNo}</Mono>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {business.address}
              </span>
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {business.contact}
              </span>
            </>
          )
        }
        actions={
          <>
            <IconButton icon={RefreshCw} label="Refresh registry" spinning={loading} onClick={refresh} />
            <Button icon={Plus} onClick={() => setIsModalOpen(true)}>
              Register instrument
            </Button>
          </>
        }
      />


      {applyMessage && (
        <Notice tone="good" icon={CheckCircle2}>
          {applyMessage}
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Registered" value={stats.total} hint="instruments" icon={Scale} />
        <StatTile label="Valid" value={stats.valid} hint="certified" tone="good" icon={ShieldCheck} emphasis />
        <StatTile label="Expiring soon" value={stats.expiringSoon} hint="within 30 days" tone="warn" icon={Clock} emphasis={stats.expiringSoon > 0} />
        <StatTile
          label="Action needed"
          value={stats.expired + stats.unverified}
          hint={`${stats.expired} expired · ${stats.unverified} unverified`}
          tone="bad"
          icon={AlertTriangle}
          emphasis={stats.expired + stats.unverified > 0}
        />
      </div>

      <ExpiryAlerts
        scope="business"
        onRenew={handleApply}
        renewingId={applyingId}
        refreshToken={alertsVersion}
      />

      <Card className="overflow-hidden">
        <CardHeader
          icon={Scale}
          title={
            <>
              Instrument registry{" "}
              <span className="ml-1 text-ink-400 font-normal tnum">{filteredInstruments.length}</span>
            </>
          }
          actions={
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search serial, category, model"
                className="field h-9 py-0 pl-9 text-[13px]"
              />
            </div>
          }
        />

        {loading ? (
          <LoadingState label="Fetching instrument records" />
        ) : filteredInstruments.length === 0 ? (
          <EmptyState
            icon={Scale}
            title={q ? "No instruments match" : "No instruments registered yet"}
            body={
              q
                ? "Try a different serial number, category or model."
                : "Register a scale, weighbridge or dispenser to begin the verification process."
            }
            action={
              !q && (
                <Button icon={Plus} onClick={() => setIsModalOpen(true)}>
                  Register instrument
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Model &amp; capacity</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Certificate</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInstruments.map((inst) => (
                  <tr key={inst.id}>
                    <td>
                      <Mono chip className="font-semibold">{inst.serialNumber}</Mono>
                      <div className="mt-1.5 text-[13px] text-ink-500">{inst.category}</div>
                    </td>
                    <td>
                      <div className="font-medium text-ink-900">{inst.model}</div>
                      <div className="mt-0.5 font-mono text-xs text-ink-500">{inst.capacity}</div>
                    </td>
                    <td className="text-ink-600">{inst.location || "Main counter"}</td>
                    <td>
                      {statusBadge(inst)}
                      {inst.computedStatus === "PENDING" &&
                        inst.latestApplication?.status === "ASSIGNED" && (
                          <div className="mt-1.5">
                            <ScheduleChip iso={inst.latestApplication.scheduledFor} now={now} muted />
                          </div>
                        )}
                    </td>
                    <td>
                      {inst.latestCertificate ? (
                        <div>
                          <Mono className="font-semibold text-ink-900">
                            {inst.latestCertificate.certNumber}
                          </Mono>
                          <div className="mt-0.5 text-xs text-ink-500">
                            Valid till {fmtDate(inst.latestCertificate.validTill)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[13px] text-ink-400">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {inst.latestCertificate && (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={QrCode}
                            onClick={() => router.push(`/verify/${inst.latestCertificate!.token}`)}
                          >
                            Certificate
                          </Button>
                        )}
                        {canApply(inst) && (
                          <Button
                            size="sm"
                            variant="accent"
                            iconRight={ArrowUpRight}
                            loading={applyingId === inst.id}
                            onClick={() => handleApply(inst.id)}
                          >
                            Apply for verification
                          </Button>
                        )}
                        <IconButton
                          icon={Trash2}
                          label="Delete instrument"
                          onClick={() => {
                            setDeletingInstrument(inst);
                            setDeleteError(null);
                          }}
                          className="h-8 w-8 text-ink-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RegisterInstrumentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchInstruments}
        businessLabel={business ? `${business.name} · ${business.regNo}` : undefined}
      />

      {deletingInstrument && (
        <Modal
          open={Boolean(deletingInstrument)}
          onClose={() => {
            if (!deleting) {
              setDeletingInstrument(null);
              setDeleteError(null);
            }
          }}
          tone="bad"
          icon={Trash2}
          title="Delete instrument"
          subtitle={`Serial: ${deletingInstrument.serialNumber}`}
          footer={
            <>
              <Button
                variant="ghost"
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeletingInstrument(null);
                  setDeleteError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                loading={deleting}
                onClick={handleDeleteInstrument}
              >
                Delete instrument
              </Button>
            </>
          }
        >
          <div className="space-y-4 p-6 text-sm text-ink-700">
            <p>
              Are you sure you want to remove this instrument from your registry? This action cannot be undone.
            </p>
            <div className="space-y-1.5 rounded-xl border border-line bg-ink-50/60 p-3.5 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-500">Category:</span>
                <span className="font-medium text-ink-900">{deletingInstrument.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Model:</span>
                <span className="font-medium text-ink-900">{deletingInstrument.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Capacity:</span>
                <span className="font-mono text-ink-900">{deletingInstrument.capacity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Location:</span>
                <span className="text-ink-900">{deletingInstrument.location || "Main counter"}</span>
              </div>
            </div>

            {deleteError && (
              <Notice tone="bad" icon={AlertTriangle}>
                {deleteError}
              </Notice>
            )}

            <p className="text-xs text-ink-400">
              Note: Instruments with an active verification application in progress cannot be deleted.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
