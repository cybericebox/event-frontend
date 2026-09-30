import {z} from "zod";
import {analyticsRequest, periodQuery, wholeEvent, type AnalyticsPeriod} from "@/api/manageAnalytics";

// «Використання»: GET .../manage/analytics/usage. Per participant, the VPN
// connection state and the lab access over the VPN and the web proxy. Counts
// and times only. Online comes from the last handshake, never from traffic.

const count = z.number().int();
const optionalTime = z.string().nullish().transform(value => value ?? null);

const sessionSchema = z.object({StartedAt: z.string(), EndedAt: z.string(), Seconds: count, RxBytes: count, TxBytes: count});
export type UsageSession = z.infer<typeof sessionSchema>;

const labSchema = z.object({
    ChallengeID: z.string(),
    Task: z.string().default(""),
    Surface: z.enum(["vpn", "proxy"]),
    Attempts: count,
    BytesIn: count,
    BytesOut: count,
    FirstAt: z.string(),
    LastAt: z.string(),
});
export type UsageLab = z.infer<typeof labSchema>;

const userSchema = z.object({
    UserID: z.string(),
    UserName: z.string().default(""),
    TeamID: z.string(),
    TeamName: z.string().default(""),
    VPN: z.object({
        Online: z.boolean(),
        LastHandshakeAt: optionalTime,
        FirstAt: optionalTime,
        Sessions: count,
        // Online time of the period.
        Seconds: count,
        RxBytes: count,
        TxBytes: count,
        Recent: z.array(sessionSchema).nullish().transform(value => value ?? []),
    }),
    // Over the whole event.
    Proxy: z.object({Requests: count, BytesIn: count, BytesOut: count, FirstAt: optionalTime, LastAt: optionalTime}),
    Labs: z.array(labSchema).nullish().transform(value => value ?? []),
});
export type UsageUser = z.infer<typeof userSchema>;

export const AnalyticsUsageSchema = z.object({
    // false: the event has no infrastructure.
    Available: z.boolean(),
    At: z.string(),
    Summary: z.object({
        Users: count, OnlineNow: count, VPNUsers: count, ProxyUsers: count, Sessions: count, OnlineSeconds: count,
        RxBytes: count, TxBytes: count, ProxyRequests: count, ProxyBytes: count,
    }),
    Users: z.array(userSchema).nullish().transform(value => value ?? []),
    Period: z.object({From: z.string(), To: z.string()}),
});
export type AnalyticsUsage = z.infer<typeof AnalyticsUsageSchema>;

export const getAnalyticsUsage = (eventID: string, period: AnalyticsPeriod = wholeEvent) =>
    analyticsRequest(eventID, `usage${periodQuery(period)}`, AnalyticsUsageSchema);
