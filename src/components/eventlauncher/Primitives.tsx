import { ArrowUpRight, Check, Circle, Mail, MessageCircle, Send } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Channel } from "@/lib/event-demo";

export function Mark({ className, small = false }: { className?: string; small?: boolean }) {
  return <span className={cn("inline-flex shrink-0 items-center justify-center rounded-xl bg-primary text-white", small ? "h-8 w-8" : "h-10 w-10", className)}><svg width={small ? 21 : 25} height={small ? 21 : 25} viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M19 15v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h7M8 6v6M4 15h9M17 4h7v7M23.5 4.5 13 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>;
}
export function ActionButton({ className, ...props }: ButtonProps) {
  return <Button className={cn("h-9 rounded-lg px-3.5 text-xs font-medium shadow-none", className)} {...props} />;
}
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const positive = ["Approved", "Completed", "Simulated as completed", "Demo connected"].includes(status);
  const warning = ["Blocked", "Overdue", "Awaiting approval"].includes(status);
  return <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium leading-none", positive ? "bg-sage-light text-sage-dark" : warning ? "bg-clay-light text-clay" : "bg-muted text-muted-foreground", className)}>{positive ? <Check className="h-3 w-3"/> : <Circle className="h-1.5 w-1.5 fill-current"/>}{status}</span>;
}
export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  const Icon = channel === "Email" ? Mail : channel === "WhatsApp" ? MessageCircle : Send;
  return <Icon className={cn("h-4 w-4", className)}/>;
}
export function SectionHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.18em] text-sage-dark">{eyebrow}</p><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>{children}</div>;
}
export function TextLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-medium text-sage-dark hover:underline">{children}<ArrowUpRight className="h-3.5 w-3.5"/></button>;
}
export const fieldClass = "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-muted disabled:text-muted-foreground";
export const labelClass = "mb-1.5 block text-[11px] font-medium text-muted-foreground";
