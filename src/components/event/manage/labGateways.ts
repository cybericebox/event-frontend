import type {LabGateway} from "@/api/manageLabs";
import {t, tPlural} from "@/i18n/t";

const gatewayList = new Intl.ListFormat("uk", {type: "unit", style: "long"});

// A lab without web addresses: the way in is the VPN, so name the subnets of its VPN gateways (none: nothing to name).
export function noWebText(gateways: LabGateway[]): string {
    const vpn = gateways.filter(gateway => gateway.Kind === "vpn");
    if (vpn.length === 0) return t("manage.labs.moderators.noWeb");
    return tPlural("manage.labs.moderators.noWebVpn", vpn.length, {gateways: gatewayList.format(vpn.map(gateway => `${gateway.Name} ${gateway.CIDR || "—"}`))});
}

