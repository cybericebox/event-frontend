import {z} from "zod";
import {manageApiError} from "@/api/manage";

export type ManagedList = "participants" | "teams";
const columnSchema = z.object({Key: z.string(), Visible: z.boolean()});
const listColumnsSchema = z.object({List: z.enum(["participants", "teams"]), Columns: z.array(columnSchema).nullish().transform(value => value ?? [])});
export type ListColumn = z.infer<typeof columnSchema>;
export type ListColumns = z.infer<typeof listColumnsSchema>;

const mockColumns = new Map<ManagedList, ListColumn[]>();

async function request(eventID: string, list: ManagedList, method: "GET" | "PUT", columns?: ListColumn[]): Promise<ListColumns> {
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    if (!domain) throw new Error("NEXT_PUBLIC_DOMAIN is required");
    const response = await fetch(`https://api.${domain}/api/events/${encodeURIComponent(eventID)}/manage/list-columns/${list}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(columns ? {"Content-Type": "application/json"} : {})},
        body: columns ? JSON.stringify({List: list, Columns: columns}) : undefined,
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: listColumnsSchema}).parse(await response.json()).Data;
}

export async function getManageListColumns(eventID: string, list: ManagedList): Promise<ListColumns> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return {List: list, Columns: mockColumns.get(list) ?? []};
    return request(eventID, list, "GET");
}

export async function putManageListColumns(eventID: string, list: ManagedList, columns: ListColumn[]): Promise<ListColumns> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
        mockColumns.set(list, columns);
        return {List: list, Columns: columns};
    }
    return request(eventID, list, "PUT", columns);
}
