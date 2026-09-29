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
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return {GatewayIP: "10.10.0.1", ProbeURL: "http://probe.lab/"};
    return readVPN(eventID, "/status", statusSchema);
}
export async function issueVPNConfig(eventID: string): Promise<string> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return "[Interface]\nAddress = 10.10.0.14/32\n";
    return (await readVPN(eventID, "", configSchema)).Config;
}
