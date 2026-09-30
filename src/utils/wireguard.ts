// wg-quick derives the interface name from the config file name, so the part
// before ".conf" must be a valid interface name: at most 15 characters from
// [a-zA-Z0-9_=+.-]. Every WireGuard config the site offers is named through here.
const IFNAME_MAX = 15;

export function wireguardFileName(base: string): string {
    const name = base.replace(/[^a-zA-Z0-9_=+.-]/g, "-").slice(0, IFNAME_MAX).replace(/-+$/, "") || "wg0";
    return `${name}.conf`;
}

// The two configs of an event: the participant's and the moderators team's.
export const PARTICIPANT_VPN_FILE = wireguardFileName("cybericebox");
export const MODERATORS_VPN_FILE = wireguardFileName("cybericebox-mod");
