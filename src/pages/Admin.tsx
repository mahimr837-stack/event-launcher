import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  ShieldCheck,
  Building2,
  CalendarDays,
  UsersRound,
  Mail,
  Send,
  Trash2,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Lock,
  Loader2,
  Activity,
  ClipboardList,
  BookOpen,
  Plus,
  Pencil,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchActiveEvent,
  saveActiveEvent,
  fetchTasks,
  deleteTask,
  fetchStakeholderInquiries,
  deleteStakeholderInquiry,
  fetchDispatchedThreads,
  fetchAdminSettings,
  saveAdminSetting,
  fetchAdminAuditLogs,
  logAdminAction,
  fetchKnowledgeBaseEntries,
  saveKnowledgeBaseEntry,
  deleteKnowledgeBaseEntry,
  type EventDoc,
  type AdminSettingDoc,
  type AdminAuditLogDoc,
  type KnowledgeBaseEntryDoc,
} from "@/lib/firestore-service";
import type { Task } from "@/lib/event-demo";
import type { InformationQuestionItem } from "@/components/eventlauncher/Integration";
import type { DispatchedLiveThread } from "@/lib/dispatched-threads";
import { cn } from "@/lib/utils";

export default function AdminPage() {
  const { user, loading, isAdmin, adminEmail, signOut } = useAuth();
  const navigate = useNavigate();

  // Active view tab inside admin
  const [activeTab, setActiveTab] = useState<"event" | "knowledge" | "settings" | "audit" | "operations">("event");

  // Live Firestore data
  const [eventData, setEventData] = useState<EventDoc | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inquiries, setInquiries] = useState<InformationQuestionItem[]>([]);
  const [threads, setThreads] = useState<DispatchedLiveThread[]>([]);
  const [settings, setSettings] = useState<AdminSettingDoc[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogDoc[]>([]);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeBaseEntryDoc[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Form states for overrides
  const [eventDraft, setEventDraft] = useState<Partial<EventDoc>>({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New admin setting form
  const [newSettingKey, setNewSettingKey] = useState("registration_portal_mode");
  const [newSettingValue, setNewSettingValue] = useState("open_student_access");

  // Knowledge Base Form state
  const [kbTitle, setKbTitle] = useState("");
  const [kbContent, setKbContent] = useState("");
  const [editingKbId, setEditingKbId] = useState<string | null>(null);
  const [isKbSaving, setIsKbSaving] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadAdminDashboardData();
    }
  }, [isAdmin]);

  async function loadAdminDashboardData() {
    setIsDataLoading(true);
    try {
      const [ev, t, inq, thr, setts, logs, kb] = await Promise.all([
        fetchActiveEvent().catch(() => null),
        fetchTasks().catch(() => []),
        fetchStakeholderInquiries().catch(() => []),
        fetchDispatchedThreads().catch(() => []),
        fetchAdminSettings().catch(() => []),
        fetchAdminAuditLogs().catch(() => []),
        fetchKnowledgeBaseEntries().catch(() => []),
      ]);

      if (ev) {
        setEventData(ev);
        setEventDraft(ev);
      }
      if (t) setTasks(t);
      if (inq) setInquiries(inq);
      if (thr) setThreads(thr);
      if (setts) setSettings(setts);
      if (logs) setAuditLogs(logs);
      if (kb) setKnowledgeEntries(kb);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load admin data.";
      setErrorMessage(msg);
    } finally {
      setIsDataLoading(false);
    }
  }

  const handleSaveKnowledgeBase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbTitle.trim() || !kbContent.trim()) return;
    setIsKbSaving(true);
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      const saved = await saveKnowledgeBaseEntry({
        id: editingKbId || undefined,
        title: kbTitle.trim(),
        content: kbContent.trim(),
      });

      await logAdminAction(
        editingKbId ? "KB_ENTRY_UPDATED" : "KB_ENTRY_CREATED",
        `Admin saved Knowledge Base entry: "${saved.title}" (ID: ${saved.id})`,
        adminEmail
      );

      const [updatedKb, updatedLogs] = await Promise.all([
        fetchKnowledgeBaseEntries().catch(() => []),
        fetchAdminAuditLogs().catch(() => []),
      ]);
      setKnowledgeEntries(updatedKb);
      setAuditLogs(updatedLogs);

      setSaveSuccessMsg(
        editingKbId
          ? `Knowledge Base entry "${saved.title}" updated in Firestore.`
          : `New Knowledge Base entry "${saved.title}" saved in Firestore.`
      );
      setKbTitle("");
      setKbContent("");
      setEditingKbId(null);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save Knowledge Base entry.";
      setErrorMessage(msg);
    } finally {
      setIsKbSaving(false);
    }
  };

  const handleEditKnowledgeBase = (entry: KnowledgeBaseEntryDoc) => {
    setEditingKbId(entry.id);
    setKbTitle(entry.title);
    setKbContent(entry.content);
    window.scrollTo({ top: 380, behavior: "smooth" });
  };

  const handleCancelKnowledgeBaseEdit = () => {
    setEditingKbId(null);
    setKbTitle("");
    setKbContent("");
  };

  const handleDeleteKnowledgeBase = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}" from the Knowledge Base?`)) return;
    setErrorMessage(null);
    try {
      await deleteKnowledgeBaseEntry(id);
      await logAdminAction(
        "KB_ENTRY_DELETED",
        `Admin deleted Knowledge Base entry: "${title}" (ID: ${id})`,
        adminEmail
      );

      const [updatedKb, updatedLogs] = await Promise.all([
        fetchKnowledgeBaseEntries().catch(() => []),
        fetchAdminAuditLogs().catch(() => []),
      ]);
      setKnowledgeEntries(updatedKb);
      setAuditLogs(updatedLogs);

      setSaveSuccessMsg(`Knowledge Base entry "${title}" removed.`);
      if (editingKbId === id) {
        handleCancelKnowledgeBaseEdit();
      }
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete Knowledge Base entry.";
      setErrorMessage(msg);
    }
  };

  const handleSaveEventOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventDraft.name) return;
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      await saveActiveEvent(eventDraft);
      await logAdminAction(
        "EVENT_PARAMETER_OVERRIDE",
        `Admin modified event: "${eventDraft.name}" (Venue: ${eventDraft.venue}, Date: ${eventDraft.date})`,
        adminEmail
      );

      setEventData((prev) => ({ ...prev, ...eventDraft } as EventDoc));
      setSaveSuccessMsg("Event parameters updated and saved to Firestore.");
      const updatedLogs = await fetchAdminAuditLogs().catch(() => []);
      setAuditLogs(updatedLogs);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to override event parameters.";
      setErrorMessage(msg);
    }
  };

  const handleSaveAdminSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSettingKey.trim() || !newSettingValue.trim()) return;

    try {
      await saveAdminSetting(newSettingKey.trim(), newSettingValue.trim(), adminEmail);
      await logAdminAction(
        "ADMIN_SETTING_MUTATION",
        `Setting "${newSettingKey}" set to "${newSettingValue}"`,
        adminEmail
      );

      const [updatedSetts, updatedLogs] = await Promise.all([
        fetchAdminSettings().catch(() => []),
        fetchAdminAuditLogs().catch(() => []),
      ]);
      setSettings(updatedSetts);
      setAuditLogs(updatedLogs);
      setSaveSuccessMsg(`Setting "${newSettingKey}" updated in Firestore /admin_settings.`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to write admin setting.";
      setErrorMessage(msg);
    }
  };

  const handleDeleteTaskAdmin = async (taskId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete task "${title}"?`)) return;

    try {
      await deleteTask(taskId);
      await logAdminAction("ADMIN_TASK_DELETED", `Admin deleted task: ${title} (${taskId})`, adminEmail);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      const updatedLogs = await fetchAdminAuditLogs().catch(() => []);
      setAuditLogs(updatedLogs);
      setSaveSuccessMsg(`Task "${title}" removed from Firestore.`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete task.";
      setErrorMessage(msg);
    }
  };

  const handleDeleteInquiryAdmin = async (inquiryId: string, question: string) => {
    if (!confirm(`Delete stakeholder inquiry "${question}"?`)) return;

    try {
      await deleteStakeholderInquiry(inquiryId);
      await logAdminAction(
        "ADMIN_INQUIRY_DELETED",
        `Admin deleted inquiry: ${question} (${inquiryId})`,
        adminEmail
      );
      setInquiries((prev) => prev.filter((i) => i.id !== inquiryId));
      const updatedLogs = await fetchAdminAuditLogs().catch(() => []);
      setAuditLogs(updatedLogs);
      setSaveSuccessMsg(`Inquiry removed.`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete inquiry.";
      setErrorMessage(msg);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F6F2]">
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-white px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-sage-dark" />
          <span className="text-sm font-medium text-foreground">
            Verifying administrative access credentials...
          </span>
        </div>
      </div>
    );
  }

  // Strictly enforce admin role redirect to home page
  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[#F4F6F2] text-foreground">
      {/* Top Banner Navigation */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to App</span>
            </button>
            <div className="h-5 w-px bg-border/60" />
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-800">
                <Lock className="h-4 w-4" />
              </span>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>EventLauncher Admin Console</span>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 border border-red-200">
                    RESTRICTED
                  </span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              <span className="font-semibold text-emerald-800">{adminEmail}</span>
              <span className="rounded bg-emerald-200/60 px-1 py-0.2 text-[9px] font-bold text-emerald-900">
                ADMIN
              </span>
            </div>

            <button
              onClick={() => {
                signOut();
                navigate("/");
              }}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Workspace */}
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Alerts / Feedback */}
        {saveSuccessMsg && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-medium text-emerald-900 flex items-center gap-2 shadow-2xs animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs font-medium text-rose-900 flex items-center gap-2 shadow-2xs animate-in fade-in">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Security Rule Enforcement Notice */}
        <div className="rounded-2xl border border-primary/20 bg-white p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sage-light text-sage-dark">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Firestore Security Rules Enforced at Cloud Level
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Only <strong>{adminEmail}</strong> is authorized to execute deletes, write to{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">/admin_settings</code>,
                  and inspect <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">/admin_audit_logs</code>.
                  Unauthorized users are rejected by Cloud Firestore rule evaluation.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadAdminDashboardData}
              disabled={isDataLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-60"
            >
              <RotateCcw className={cn("h-3.5 w-3.5", isDataLoading && "animate-spin")} />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="rounded-xl border border-border/80 bg-white p-4 shadow-2xs">
            <p className="text-[11px] font-medium text-muted-foreground">Active Event</p>
            <p className="mt-1 text-lg font-bold text-foreground truncate">
              {eventData?.name || "Career Seminar"}
            </p>
            <p className="mt-0.5 text-[10px] text-sage-dark font-medium">
              {eventData?.venue || "North Hall Auditorium"}
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-white p-4 shadow-2xs">
            <p className="text-[11px] font-medium text-muted-foreground">Operational Tasks</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{tasks.length}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {tasks.filter((t) => t.status === "Completed").length} completed
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-white p-4 shadow-2xs">
            <p className="text-[11px] font-medium text-muted-foreground">Stakeholder Inquiries</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{inquiries.length}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Active outreach queues</p>
          </div>

          <div className="rounded-xl border border-border/80 bg-white p-4 shadow-2xs">
            <p className="text-[11px] font-medium text-muted-foreground">Audit Log Entries</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{auditLogs.length}</p>
            <p className="mt-0.5 text-[10px] text-emerald-700 font-medium">Secured in Firestore</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex w-full items-center gap-1.5 rounded-xl border border-border/80 bg-white p-1.5 shadow-2xs overflow-x-auto">
          {[
            { id: "event" as const, label: "Event Parameter Override", icon: CalendarDays },
            { id: "knowledge" as const, label: "Knowledge Base (/knowledge_base)", icon: BookOpen },
            { id: "settings" as const, label: "Admin Settings (/admin_settings)", icon: ShieldAlert },
            { id: "audit" as const, label: "Audit Logs (/admin_audit_logs)", icon: Activity },
            { id: "operations" as const, label: "Task & Inquiry Governance", icon: ClipboardList },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                  isSelected
                    ? "bg-sage-light text-sage-dark ring-1 ring-primary/25 shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: EVENT OVERRIDE */}
        {activeTab === "event" && (
          <div className="rounded-2xl border border-border/80 bg-white p-6 shadow-2xs space-y-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Master Event Parameter Override
              </h3>
              <p className="text-xs text-muted-foreground">
                As system administrator, you can update event details in Firestore. Changes immediately propagate to all attendees and coordinator micro-agents.
              </p>
            </div>

            <form onSubmit={handleSaveEventOverride} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">
                    Event Title / Headline
                  </label>
                  <input
                    type="text"
                    required
                    value={eventDraft.name || ""}
                    onChange={(e) => setEventDraft({ ...eventDraft, name: e.target.value })}
                    className="w-full rounded-lg border border-border p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1.5 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">
                    Department / Category
                  </label>
                  <input
                    type="text"
                    value={eventDraft.category || ""}
                    onChange={(e) => setEventDraft({ ...eventDraft, category: e.target.value })}
                    className="w-full rounded-lg border border-border p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1.5 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">Event Date</label>
                  <input
                    type="date"
                    value={eventDraft.date || ""}
                    onChange={(e) => setEventDraft({ ...eventDraft, date: e.target.value })}
                    className="w-full rounded-lg border border-border p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1.5 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">Start Time</label>
                  <input
                    type="time"
                    value={eventDraft.time || "14:00"}
                    onChange={(e) => setEventDraft({ ...eventDraft, time: e.target.value })}
                    className="w-full rounded-lg border border-border p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1.5 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">Campus Venue</label>
                  <input
                    type="text"
                    value={eventDraft.venue || ""}
                    onChange={(e) => setEventDraft({ ...eventDraft, venue: e.target.value })}
                    className="w-full rounded-lg border border-border p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1.5 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">Keynote Speaker</label>
                  <input
                    type="text"
                    value={eventDraft.speaker || ""}
                    onChange={(e) => setEventDraft({ ...eventDraft, speaker: e.target.value })}
                    className="w-full rounded-lg border border-border p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1.5 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">Expected Audience Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={eventDraft.audience || 200}
                    onChange={(e) =>
                      setEventDraft({ ...eventDraft, audience: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full rounded-lg border border-border p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1.5 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">Budget Allocation</label>
                  <input
                    type="text"
                    value={eventDraft.budget || ""}
                    onChange={(e) => setEventDraft({ ...eventDraft, budget: e.target.value })}
                    className="w-full rounded-lg border border-border p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1.5 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Override to Firestore</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB: KNOWLEDGE BASE (/knowledge_base) */}
        {activeTab === "knowledge" && (
          <div className="space-y-6">
            {/* Create / Edit Knowledge Base Entry Form */}
            <div className="rounded-2xl border border-border/80 bg-white p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sage-light text-sage-dark">
                    <BookOpen className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {editingKbId ? "Edit Knowledge Base Entry" : "Add Knowledge Base Entry"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Stored in Firestore <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">/knowledge_base</code>. All AI agents read this knowledge base before responding to user inquiries.
                    </p>
                  </div>
                </div>

                {editingKbId && (
                  <button
                    type="button"
                    onClick={handleCancelKnowledgeBaseEdit}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Cancel edit</span>
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveKnowledgeBase} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. University Campus Venue & Noise Clearance Protocols"
                    value={kbTitle}
                    onChange={(e) => setKbTitle(e.target.value)}
                    className="w-full rounded-lg border border-border p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1.5 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">
                    Content
                  </label>
                  <textarea
                    required
                    rows={8}
                    placeholder="Enter full organizational policies, guidelines, timeline rules, or event best practices..."
                    value={kbContent}
                    onChange={(e) => setKbContent(e.target.value)}
                    className="w-full rounded-lg border border-border p-3 text-xs text-foreground focus:outline-hidden focus:ring-1.5 focus:ring-primary/40 font-mono leading-relaxed"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    The AI agents cite this content directly for best practices.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {editingKbId && (
                    <button
                      type="button"
                      onClick={handleCancelKnowledgeBaseEdit}
                      className="rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isKbSaving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    {isKbSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span>{editingKbId ? "Update Entry in Firestore" : "Add to Knowledge Base"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Simple List of Knowledge Base Entries */}
            <div className="rounded-2xl border border-border/80 bg-white p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>Knowledge Base Entries</span>
                    <span className="rounded-full bg-sage-light px-2 py-0.5 text-[10px] font-bold text-sage-dark">
                      {knowledgeEntries.length}
                    </span>
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Readable by AI agents. Managed exclusively by administrator ({adminEmail}).
                  </p>
                </div>
              </div>

              {knowledgeEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                  No knowledge base entries in Firestore. Use the form above to add an entry.
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {knowledgeEntries.map((entry) => (
                    <div key={entry.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <h5 className="text-xs font-bold text-foreground flex items-center gap-2">
                            <span>{entry.title}</span>
                            <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground">
                              {entry.id}
                            </span>
                          </h5>
                          {entry.updatedAt && (
                            <p className="text-[10px] text-muted-foreground">
                              Last updated: {new Date(entry.updatedAt).toLocaleString()}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditKnowledgeBase(entry)}
                            title="Edit entry"
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted cursor-pointer transition-colors"
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteKnowledgeBase(entry.id, entry.title)}
                            title="Delete entry"
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 cursor-pointer transition-colors"
                          >
                            <Trash2 className="h-3 w-3 text-red-600" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg bg-muted/40 p-3.5 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto font-sans border border-border/40">
                        {entry.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ADMIN SETTINGS (/admin_settings) */}
        {activeTab === "settings" && (
          <div className="rounded-2xl border border-border/80 bg-white p-6 shadow-2xs space-y-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Cloud Configuration (<code className="text-xs font-mono">/admin_settings</code>)
              </h3>
              <p className="text-xs text-muted-foreground">
                Only the administrator ({adminEmail}) can read and write to this collection. Protected strictly by Firestore security rules.
              </p>
            </div>

            {/* Create / Update Setting Form */}
            <form onSubmit={handleSaveAdminSetting} className="rounded-xl border border-border/70 bg-[#FAFAF8] p-4 space-y-3">
              <h4 className="text-xs font-semibold text-foreground">Add or Update Admin Setting</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Setting Key</label>
                  <input
                    type="text"
                    required
                    value={newSettingKey}
                    onChange={(e) => setNewSettingKey(e.target.value)}
                    placeholder="e.g. registration_portal_mode"
                    className="mt-1 w-full rounded-lg border border-border bg-white p-2 text-xs text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Setting Value</label>
                  <input
                    type="text"
                    required
                    value={newSettingValue}
                    onChange={(e) => setNewSettingValue(e.target.value)}
                    placeholder="e.g. open_student_access"
                    className="mt-1 w-full rounded-lg border border-border bg-white p-2 text-xs text-foreground"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Setting</span>
                </button>
              </div>
            </form>

            {/* Active Settings List */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground">
                Existing Admin Settings ({settings.length})
              </h4>
              {settings.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-xl">
                  No custom settings saved yet. Use the form above to add an admin configuration key.
                </p>
              ) : (
                <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-white">
                  {settings.map((s) => (
                    <div key={s.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-semibold text-foreground font-mono">{s.key}</span>
                        <p className="text-muted-foreground mt-0.5">{s.value}</p>
                      </div>
                      <div className="text-right text-[10px] text-muted-foreground">
                        <p>Updated by {s.updatedBy}</p>
                        <p>{new Date(s.updatedAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT LOGS (/admin_audit_logs) */}
        {activeTab === "audit" && (
          <div className="rounded-2xl border border-border/80 bg-white p-6 shadow-2xs space-y-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Administrative Security Audit Logs
              </h3>
              <p className="text-xs text-muted-foreground">
                Immutable records of administrative actions. Read access is strictly locked to {adminEmail} via Firestore rules.
              </p>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center border border-dashed rounded-xl">
                No admin actions logged yet in this session.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAF8] text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Action Type</th>
                      <th className="p-3">Admin</th>
                      <th className="p-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30">
                        <td className="p-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="p-3">
                          <span className="rounded bg-sage-light px-2 py-0.5 text-[10px] font-bold text-sage-dark font-mono">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-foreground">{log.adminEmail}</td>
                        <td className="p-3 text-muted-foreground">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: TASK & INQUIRY GOVERNANCE */}
        {activeTab === "operations" && (
          <div className="space-y-6">
            {/* Task deletion table (Rules allow delete only for admin) */}
            <div className="rounded-2xl border border-border/80 bg-white p-6 shadow-2xs space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Task Governance & Admin Deletion
                </h3>
                <p className="text-xs text-muted-foreground">
                  Firestore rules enforce that <code className="font-mono text-[11px]">allow delete</code> on <code className="font-mono text-[11px]">/tasks</code> is restricted exclusively to {adminEmail}.
                </p>
              </div>

              <div className="divide-y divide-border/60 rounded-xl border border-border/80">
                {tasks.map((task) => (
                  <div key={task.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-foreground">{task.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Owner: {task.owner} ({task.email}) · Due: {task.deadline} · Status: {task.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteTaskAdmin(task.id, task.title)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete as Admin</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Stakeholder inquiries deletion table */}
            <div className="rounded-2xl border border-border/80 bg-white p-6 shadow-2xs space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Stakeholder Inquiries Governance
                </h3>
                <p className="text-xs text-muted-foreground">
                  Admin-only deletion enforcement on <code className="font-mono text-[11px]">/stakeholder_inquiries</code>.
                </p>
              </div>

              <div className="divide-y divide-border/60 rounded-xl border border-border/80">
                {inquiries.map((inq) => (
                  <div key={inq.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-foreground">{inq.question}</p>
                      <p className="text-[11px] text-muted-foreground">
                        To: {inq.recipientName} ({inq.recipientContact}) · Platform: {inq.platform}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteInquiryAdmin(inq.id, inq.question)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete as Admin</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
