"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import {
  CheckCircle2, Clock, XCircle, HelpCircle, RefreshCw, PartyPopper,
  ExternalLink, Send, Loader2, ListChecks,
} from "lucide-react";
import api from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { RoleGuard } from "@/components/layout/role-guard";

type Level = "approved" | "pending" | "not_started" | "rejected" | "unknown" | "connected" | "disconnected" | "synced" | "none";

interface SetupStatus {
  workspaceCreated: boolean;
  whatsappConnected: boolean;
  numberInfo: { displayName: string; phoneNumber: string; wabaId: string; phoneNumberId: string; status: string } | null;
  businessVerification: Level;
  paymentMethod: Level;
  displayNameStatus: Level;
  webhook: Level;
  templates: { status: Level; count: number };
  productionReady: boolean;
  checkedAt: string;
}

// Green = done, Yellow = in progress, Red = failed, Gray = can't be determined.
const BADGE_STYLES: Record<Level, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  approved: { label: "Completed", className: "bg-green-100 text-green-700", icon: CheckCircle2 },
  connected: { label: "Connected", className: "bg-green-100 text-green-700", icon: CheckCircle2 },
  synced: { label: "Synced", className: "bg-green-100 text-green-700", icon: CheckCircle2 },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700", icon: Clock },
  not_started: { label: "Not Started", className: "bg-gray-100 text-gray-600", icon: HelpCircle },
  none: { label: "No Templates", className: "bg-gray-100 text-gray-600", icon: HelpCircle },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700", icon: XCircle },
  disconnected: { label: "Disconnected", className: "bg-red-100 text-red-700", icon: XCircle },
  unknown: { label: "Unknown", className: "bg-gray-100 text-gray-500", icon: HelpCircle },
};

function StatusBadge({ level }: { level: Level }) {
  const { label, className, icon: Icon } = BADGE_STYLES[level];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </span>
  );
}

function ChecklistCard({
  title, description, level, checkedAt, action, children,
}: {
  title: string;
  description?: string;
  level: Level;
  checkedAt?: string;
  action?: { label: string; href?: string; onClick?: () => void; loading?: boolean };
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <StatusBadge level={level} />
      </div>
      {description && <p className="text-xs text-gray-500 mb-3">{description}</p>}
      {children}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
        {checkedAt ? (
          <span className="text-[11px] text-gray-400">Last checked {formatRelativeTime(checkedAt)}</span>
        ) : <span />}
        {action && (
          action.href ? (
            <a href={action.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {action.label} <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <button onClick={action.onClick} disabled={action.loading} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50">
              {action.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null} {action.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function OnboardingContent() {
  const queryClient = useQueryClient();
  const [testTo, setTestTo] = useState("");

  const { data: numbers, isLoading: numbersLoading } = useQuery({
    queryKey: ["numbers"],
    queryFn: () => api.get("/numbers").then((r) => r.data),
  });
  const numberId = numbers?.[0]?.id as string | undefined;

  const { data: status, isLoading: statusLoading, refetch, isFetching } = useQuery<SetupStatus>({
    queryKey: ["setup-status", numberId],
    queryFn: () => api.get(`/numbers/${numberId}/setup-status`).then((r) => r.data),
    enabled: !!numberId,
    // Keep checking in the background while onboarding isn't finished yet;
    // once everything's green there's nothing left to change, so stop.
    refetchInterval: (query) => (query.state.data?.productionReady ? false : 5 * 60 * 1000),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post("/templates/sync", { numberId }),
    onSuccess: (r) => {
      toast.success(r.data.message || "Templates synced");
      queryClient.invalidateQueries({ queryKey: ["setup-status", numberId] });
    },
    onError: (e: { response?: { data?: { error?: string } } }) => toast.error(e.response?.data?.error || "Failed to sync templates"),
  });

  const testMessageMutation = useMutation({
    mutationFn: () => api.post(`/numbers/${numberId}/test-message`, { to: testTo }),
    onSuccess: () => toast.success("Test message sent — check the recipient's WhatsApp."),
    onError: (e: { response?: { data?: { error?: string } } }) => toast.error(e.response?.data?.error || "Failed to send test message"),
  });

  if (numbersLoading || statusLoading) {
    return <div className="p-6 max-w-4xl mx-auto"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  if (!numberId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <ListChecks className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-gray-900 mb-1">No WhatsApp number connected yet</h1>
          <p className="text-sm text-gray-500 mb-4">Connect a number first to see your setup checklist.</p>
          <Link href="/onboarding/connect-whatsapp" className="inline-block bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-600">
            Connect WhatsApp
          </Link>
        </div>
      </div>
    );
  }

  if (!status) return null;

  // Payment method is intentionally excluded (always "unknown" -- see backend
  // comment); counting it would make 100% unreachable for everyone.
  const trackedSteps: Level[] = [
    status.whatsappConnected ? "approved" : "unknown",
    status.businessVerification,
    status.displayNameStatus,
    status.webhook === "connected" ? "approved" : status.webhook,
    status.templates.status === "synced" ? "approved" : status.templates.status,
  ];
  const completedCount = trackedSteps.filter((l) => l === "approved").length + 1; // +1 for Workspace Created
  const totalSteps = trackedSteps.length + 1;
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meta WhatsApp Setup</h1>
          <p className="text-gray-500 text-sm mt-1">Finish these steps to get your WhatsApp Business Account production-ready.</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 border border-gray-200 text-gray-600 px-3.5 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh Meta Status
        </button>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm font-semibold text-gray-900">{progressPct}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Production ready banner */}
      {status.productionReady ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
          <PartyPopper className="w-6 h-6 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Congratulations! Your WhatsApp Business Account is ready.</p>
            <p className="text-xs text-green-700 mt-0.5">All required steps are complete.</p>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800">Complete the remaining steps below before using Wazenly in production.</p>
        </div>
      )}

      {/* Checklist grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        <ChecklistCard title="Workspace Created" level="approved" />

        <ChecklistCard title="WhatsApp Connected" level="approved" checkedAt={status.checkedAt}>
          {status.numberInfo && (
            <div className="text-xs text-gray-500 space-y-1 mb-1">
              <p>Business Name: <span className="text-gray-700 font-medium">{status.numberInfo.displayName}</span></p>
              <p>WABA ID: <span className="font-mono text-gray-700">{status.numberInfo.wabaId}</span></p>
              <p>Phone Number: <span className="text-gray-700 font-medium">{status.numberInfo.phoneNumber}</span></p>
              <p>Phone Number ID: <span className="font-mono text-gray-700">{status.numberInfo.phoneNumberId}</span></p>
            </div>
          )}
        </ChecklistCard>

        <ChecklistCard
          title="Business Verification"
          description="Business verification increases trust and unlocks Meta features."
          level={status.businessVerification}
          checkedAt={status.checkedAt}
          action={status.businessVerification !== "approved" ? { label: "Verify Business", href: "https://business.facebook.com/settings/security" } : undefined}
        />

        <ChecklistCard
          title="Payment Method"
          description="Meta requires a payment method for conversation billing. This can't be checked automatically — verify it directly in Meta."
          level={status.paymentMethod}
          action={{ label: "Add Payment Method", href: "https://business.facebook.com/billing_hub/accounts" }}
        />

        <ChecklistCard title="Display Name" level={status.displayNameStatus} checkedAt={status.checkedAt} />

        <ChecklistCard title="Webhook" level={status.webhook === "connected" ? "connected" : status.webhook === "disconnected" ? "disconnected" : "unknown"} checkedAt={status.checkedAt} />

        <ChecklistCard
          title="Templates"
          level={status.templates.status === "synced" ? "synced" : "none"}
          checkedAt={status.checkedAt}
          action={{ label: "Sync Templates", onClick: () => syncMutation.mutate(), loading: syncMutation.isPending }}
        >
          <p className="text-xs text-gray-500">{status.templates.count} template{status.templates.count === 1 ? "" : "s"} synced</p>
        </ChecklistCard>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:col-span-2">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Send a Test Message</h3>
          <p className="text-xs text-gray-500 mb-3">Confirm everything works by sending Meta&apos;s sample template to a real number.</p>
          <div className="flex gap-2">
            <input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="+1 555 123 4567"
              className="flat-input flex-1 px-3 py-2 text-sm"
            />
            <button
              onClick={() => testMessageMutation.mutate()}
              disabled={testMessageMutation.isPending || !testTo}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-60"
            >
              {testMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Test Message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <RoleGuard minRole="MANAGER">
      <OnboardingContent />
    </RoleGuard>
  );
}
