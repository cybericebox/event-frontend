import {getCommonValues} from "@/api/commonPage";
import {z} from "zod";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const eventID = z.uuid().safeParse(url.searchParams.get("eventId"));
    const slug = url.searchParams.get("page");
    if (!eventID.success || (slug !== null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
        return Response.json({error: "Invalid event or page"}, {status: 400});
    }
    if (!request.headers.get("host")) return Response.json({error: "Event host unavailable"}, {status: 503});
    const headers = {"Cache-Control": "no-store"};
    try {
        // Current visibility and event binding gate every short-lived shared values read.
        const values = await getCommonValues(slug ?? "", eventID.data);
        return values ? Response.json({Variables: values}, {headers}) : new Response(null, {status: 404, headers});
    } catch {
        return Response.json({error: "Values unavailable"}, {status: 502, headers});
    }
}
