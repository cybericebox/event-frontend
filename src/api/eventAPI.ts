import type {EventInfo, Score} from "@/types/event";

export const getEventInfoFn = async (): Promise<EventInfo> => {
    return await fetch('/api/events/self/info', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
    }).then(res => res.json());
}

export const getJoinEventStatusFn = async () => {
    return await fetch('/api/events/self/join', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }).then(res => res.json());

}

export const joinEventFn = async () => {
    return await fetch('/api/events/self/join', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }).then(res => res.json());
}


export const getScore = async (): Promise<Score> => {
    return await fetch('api/events/self/score', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }).then(res => res.json());
}