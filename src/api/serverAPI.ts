import type {EventInfo, } from "@/types/event";
import {headers} from "next/headers";
import getEnv from "@/utils/helper";

export const getEventInfoOnServerFn = async (): Promise<EventInfo> => {
    const domain = getEnv("DOMAIN") || ""
    const eventUrl = `https://${headers().get("subdomain")}.${domain}`
    return await fetch(`${eventUrl}/api/events/self/info`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        next: {
            revalidate: 3, // 5 minutes
        },

    }).then(res => {
        if (res.ok) {
            return res.json();
        }
        return {} as EventInfo;
    });
}