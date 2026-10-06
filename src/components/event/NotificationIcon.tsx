import {AlertTriangle, Bell, CalendarDays, CheckCircle2, CircleHelp, Info, Mail, ShieldCheck, Trophy, UserRound, XCircle, type LucideIcon} from "lucide-react";

const icons: Record<string, LucideIcon> = {
    info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle,
    bell: Bell, mail: Mail, calendar: CalendarDays, user: UserRound,
    shield: ShieldCheck, trophy: Trophy, help: CircleHelp,
};
const tones: Record<string, string> = {
    neutral: "var(--ib-dim)", info: "var(--ib-action)", success: "var(--ib-ok)",
    warning: "var(--ib-warn)", danger: "var(--ib-danger)",
};

export function notificationAccent(tone = "neutral", accentColor = ""): string {
    return /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(accentColor)
        ? accentColor : tones[tone] ?? tones.neutral;
}

export function NotificationIcon({icon = "bell", tone = "neutral", accentColor = "", compact = false}: {
    icon?: string; tone?: string; accentColor?: string; compact?: boolean;
}) {
    const accent = notificationAccent(tone, accentColor);
    const Icon = icons[icon] ?? Bell;
    return <span className={`event-notification-icon${compact ? " is-compact" : ""}`} aria-hidden="true"
        style={{color: accent, backgroundColor: `color-mix(in srgb, ${accent} 12%, var(--ib-surface))`}}>
        <Icon size={compact ? 16 : 20} strokeWidth={1.8} />
    </span>;
}
