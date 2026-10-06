import type {SnapshotPlaceholder} from "@/api/participantChallenges";
import {t} from "@/i18n/t";

// What an organizer sees for a description placeholder before any lab exists:
// a readable label built from the placeholder's own data, never its raw key.
export function placeholderLabel(placeholder: SnapshotPlaceholder): string {
    const device = placeholder.device_name?.trim();
    switch (placeholder.kind) {
        case "vpn.subnet": return t("manage.placeholder.vpnSubnet");
        case "internet.subnet": return t("manage.placeholder.internetSubnet");
        case "external.link": return t("manage.placeholder.externalLink", {device: device || "—"});
        case "ip": {
            if (placeholder.as_link) {
                const port = placeholder.port ? `:${placeholder.port}` : "";
                return t("manage.placeholder.ipLink", {target: `${placeholder.scheme || "http"}://…${port}`});
            }
            if (device) return t("manage.placeholder.ipDevice", {device});
            const octet = placeholder.last_octet ?? 0;
            if (placeholder.ip_reference === "static") return t("manage.placeholder.ipStatic", {address: `${placeholder.octets_1to3 ?? ""}.${octet}`});
            return t("manage.placeholder.ipRef", {reference: t(`manage.placeholder.ref.${placeholder.ip_reference === "internet" ? "internet" : "vpn"}`), octet});
        }
        default: return placeholder.key;
    }
}

// Placeholder key -> «[label]» for plain-text previews.
export function placeholderChips(placeholders: SnapshotPlaceholder[]): Record<string, string> {
    const chips: Record<string, string> = {};
    for (const placeholder of placeholders) if (placeholder.key) chips[placeholder.key] = `[${placeholderLabel(placeholder)}]`;
    return chips;
}
