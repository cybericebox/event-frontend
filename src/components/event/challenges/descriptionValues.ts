import type {LabRuntime} from "@/api/manageLabs";
import type {SnapshotPlaceholder} from "@/api/participantChallenges";

export type DescriptionValues = {variables: Record<string, string>; links: Record<string, string>};

// Shown in place of a value the lab has not produced yet (or that has no lab at all).
const UNRESOLVED = "—";

function splitCidr(cidr: string): {network3: string; mask: string} | null {
    const [address, mask] = cidr.split("/");
    const octets = (address ?? "").split(".");
    return mask && octets.length === 4 ? {network3: octets.slice(0, 3).join("."), mask} : null;
}

function relativeIp(cidr: string, lastOctet: number, showMask: boolean): string {
    const parsed = splitCidr(cidr);
    if (!parsed) return "";
    return `${parsed.network3}.${lastOctet}${showMask ? `/${parsed.mask}` : ""}`;
}

export function linkUrl(scheme: string, ip: string, port?: number, path?: string): string {
    return `${scheme}://${ip}${port ? `:${port}` : ""}${path ?? ""}`;
}

function resolveOne(placeholder: SnapshotPlaceholder, lab: LabRuntime | undefined): string {
    if (!lab) return "";
    const showMask = placeholder.show_mask ?? false;
    const lastOctet = placeholder.last_octet ?? 0;
    switch (placeholder.kind) {
        // A subnet always reads as a CIDR (10.128.1.0/24); a bare network address is not a subnet.
        case "vpn.subnet": return lab.VPNCIDR ?? "";
        case "internet.subnet": return lab.InternetCIDR ?? "";
        case "ip": {
            const mask = showMask && !placeholder.as_link;
            switch (placeholder.ip_reference) {
                case "vpn": return lab.VPNCIDR ? relativeIp(lab.VPNCIDR, lastOctet, mask) : "";
                case "internet": return lab.InternetCIDR ? relativeIp(lab.InternetCIDR, lastOctet, mask) : "";
                case "static": return placeholder.octets_1to3 ? `${placeholder.octets_1to3}.${lastOctet}` : "";
                default: return "";
            }
        }
        default: return "";
    }
}

// Fills the description's placeholder variables from the team's lab. A link-form IP becomes
// the full URL scheme://ip[:port][path] and is also returned in `links` so it renders as <a>.
export function descriptionValues(placeholders: SnapshotPlaceholder[], lab: LabRuntime | undefined): DescriptionValues {
    const variables: Record<string, string> = {};
    const links: Record<string, string> = {};
    for (const placeholder of placeholders) {
        if (!placeholder.key) continue;
        const ip = resolveOne(placeholder, lab);
        if (placeholder.kind === "ip" && placeholder.as_link && ip) {
            const url = linkUrl(placeholder.scheme || "http", ip, placeholder.port, placeholder.path);
            variables[placeholder.key] = url;
            links[placeholder.key] = url;
        } else {
            variables[placeholder.key] = ip || UNRESOLVED;
        }
    }
    return {variables, links};
}
