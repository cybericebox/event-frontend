import {EventInfoSchema, type IEventInfo} from "@/types/event";
import {headers} from "next/headers";
import type {IResponse} from "@/types/api";
import {ErrorInvalidResponseData} from "@/types/common";
import {eventInfoFixture} from "@/api/mock/fixtures/event";

export const getEventInfoOnServerFn = async (): Promise<IResponse<IEventInfo>> => {
    // Mock gate: the Task-4 mock adapter only patches the CLIENT axios instance, so the
    // server render path has no backend under local dev. When mocks are on, serve the same
    // fixture the client uses so server + client event data stay consistent.
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        return eventInfoFixture;
    }
    const eventHost = (await headers()).get("host");
    const apiHost = `api.${process.env.NEXT_PUBLIC_DOMAIN}`;
    const internalOrigin = process.env.INTERNAL_API_ORIGIN;
    const response =  await fetch(`${internalOrigin ?? `https://${apiHost}`}/api/events/self/info`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Origin: `https://${eventHost}`,
            ...(internalOrigin ? {Host: apiHost} : {}),
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
