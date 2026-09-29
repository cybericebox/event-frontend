import {z} from "zod";
import {requireApiOrigin} from "@/utils/origins";

const statusSchema = z.object({GatewayIP: z.ipv4(), ProbeURL: z.url()});
const configSchema = z.object({Config: z.string().min(1)});
export type VPNStatus = z.infer<typeof statusSchema>;

export class VPNApiError extends Error {
    constructor(readonly status: number) {
        super(`Event VPN request failed: ${status}`);
    }
}

async function readVPN<T>(eventID: string, path: string, schema: z.ZodType<T>): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/teams/labs/vpn${path}`, {
        credentials: "include",
        cache: "no-store",
        headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new VPNApiError(response.status);
    const body: unknown = await response.json();
    return z.object({Data: schema}).parse(body).Data;
}

export async function getVPNStatus(eventID: string): Promise<VPNStatus> {
    return readVPN(eventID, "/status", statusSchema);
}
export async function issueVPNConfig(eventID: string): Promise<string> {
    return (await readVPN(eventID, "", configSchema)).Config;
}
