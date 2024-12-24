import {EventInfoSchema, type IEventInfo} from "@/types/event";
import {headers} from "next/headers";
import type {IResponse} from "@/types/api";
import {ErrorInvalidResponseData} from "@/types/common";

export const getEventInfoOnServerFn = async (): Promise<IResponse<IEventInfo>> => {
    const eventUrl = `https://${(await headers()).get("subdomain")}.${process.env.NEXT_PUBLIC_DOMAIN}`
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
            console.log(res.error)
            throw ErrorInvalidResponseData
        } else {
            data.Data = res.data;
        }
        return data;
    }
    return Promise.resolve({} as IResponse<IEventInfo>);
}