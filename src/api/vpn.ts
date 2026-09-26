import {z} from "zod";

const statusSchema = z.object({GatewayIP: z.ipv4(), ProbeURL: z.url()});
const configSchema = z.object({Config: z.string().min(1)});
export type VPNStatus = z.infer<typeof statusSchema>;

export class VPNApiError extends Error {
    constructor(readonly status: number) {
        super(`Event VPN request failed: ${status}`);
    }
}

async function readVPN<T>(eventID: string, path: string, schema: z.ZodType<T>): Promise<T> {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/teams/labs/vpn${path}`, {
        credentials: "include",
        cache: "no-store",
        headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new VPNApiError(response.status);
    const body: unknown = await response.json();
    return z.object({Data: schema}).parse(body).Data;
}

export const getVPNStatus = (eventID: string) => readVPN(eventID, "/status", statusSchema);
export const issueVPNConfig = async (eventID: string) => (await readVPN(eventID, "", configSchema)).Config;
