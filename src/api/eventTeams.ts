export class EventTeamError extends Error {
    constructor(readonly status: number) {
        super(`Event team request failed: ${status}`);
    }
}

async function send(eventID: string, path: string, body: Record<string, string>): Promise<void> {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/teams${path}`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify(body),
    });
    if (!response.ok) throw new EventTeamError(response.status);
}

export const createEventTeam = (eventID: string, name: string) => send(eventID, "", {Name: name});
export const joinEventTeam = (eventID: string, joinCode: string) => send(eventID, "/join", {JoinCode: joinCode});
