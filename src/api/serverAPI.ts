import {EventInfoSchema, IEventInfo,} from "@/types/event";
import {headers} from "next/headers";
import {IResponse} from "@/types/api";

export const getEventInfoOnServerFn = async (): Promise<IResponse<IEventInfo>> => {
    console.log("getEventInfoOnServerFn", headers().get("subdomain"))
    const eventUrl = `https://${headers().get("subdomain")}.${process.env.NEXT_PUBLIC_DOMAIN}`
    const response =  await fetch(`${eventUrl}/api/events/self/info`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        next: {
            revalidate: 3, // 5 minutes
        },

    })
    if (response.ok) {
        // parse the response
        const data = await response.json() as IResponse<IEventInfo>;
        const res = EventInfoSchema.safeParse(data.Data);
        if (!res.success) {
            throw new Error("Invalid response");
        } else {
            data.Data = res.data;
        }
        return data;
    }
    return Promise.resolve({} as IResponse<IEventInfo>);
}