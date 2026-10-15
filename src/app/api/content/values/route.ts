import {getCommonManifest, getCommonPage} from "@/api/commonPage";
import {z} from "zod";
import {ContentValueSchema} from "@/types/eventContent";
import {apiHost} from "@/utils/origins";
import {fetchPublic} from "@/api/publicFetch";

const valuesSchema = z.object({Data: z.object({Variables: z.record(z.string(), ContentValueSchema)})});

export async function GET(request: Request) {
    const url = new URL(request.url);
    const eventID = z.uuid().safeParse(url.searchParams.get("eventId"));
    const slug = url.searchParams.get("page");
    if (!eventID.success || (slug !== null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
        return Response.json({error: "Invalid event or page"}, {status: 400});
    }
    const host = request.headers.get("host");
    if (!host || !apiHost) return Response.json({error: "Event host unavailable"}, {status: 503});
    // Permission is hard-revalidated before any values can be read, including a warmed old URL.
    const manifest = await getCommonManifest(slug ?? "");
    if (!manifest || manifest.Event.EventID !== eventID.data) return new Response(null, {status: 404, headers: {"Cache-Control": "no-store"}});
    if (manifest.Audience === "staff") {
        const bundle = await getCommonPage(slug ?? "");
        return bundle ? Response.json({Variables: bundle.Variables}, {headers: {"Cache-Control": "no-store"}}) : new Response(null, {status: 404});
    }
    const internalOrigin = process.env.INTERNAL_API_ORIGIN;
    const path = `/api/events/${eventID.data}/content${slug ? `/pages/${encodeURIComponent(slug)}` : ""}/values`;
    // Counts remain separate from the revision-bound published document.
    const response = await fetchPublic(`${internalOrigin ?? `https://${apiHost}`}${path}`, {
        Accept: "application/json",
        Origin: `https://${host}`,
        ...(internalOrigin ? {Host: apiHost} : {}),
    });
    if (response.status === 404) return Response.json({error: "Event page unavailable"}, {status: 404});
    if (response.status < 200 || response.status >= 300) return Response.json({error: "Values unavailable"}, {status: 502});
    const parsed = valuesSchema.safeParse(response.body);
    if (!parsed.success) return Response.json({error: "Invalid values"}, {status: 502});
    return Response.json(parsed.data.Data, {headers: {"Cache-Control": "no-store"}});
}
