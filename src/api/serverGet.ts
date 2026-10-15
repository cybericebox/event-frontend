import {request as httpRequest} from "node:http";
import {request as httpsRequest} from "node:https";
import {Readable} from "node:stream";

// Fetch deliberately discards Host overrides. In-cluster API routing needs the
// configured API host while the TCP connection goes to the internal Service.
export function serverGet(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<Response> {
    if (!Object.keys(headers).some(name => name.toLowerCase() === "host")) {
        return fetch(url, {headers, signal, cache: "no-store"});
    }
    const target = new URL(url);
    if (target.protocol !== "http:" && target.protocol !== "https:") return Promise.reject(new Error("Unsupported internal API protocol"));
    return new Promise((resolve, reject) => {
        const request = (target.protocol === "https:" ? httpsRequest : httpRequest)(target, {headers, signal}, response => {
            const responseHeaders = new Headers();
            for (const [name, value] of Object.entries(response.headers)) {
                if (value !== undefined) responseHeaders.set(name, Array.isArray(value) ? value.join(", ") : value);
            }
            const status = response.statusCode ?? 502;
            // Never follow redirects with the read grant or the routing Host.
            // Drain denied/empty replies so the connection can be reused.
            const empty = status < 200 || status >= 300 || status === 204 || status === 205;
            if (empty) response.resume();
            resolve(new Response(empty ? null : Readable.toWeb(response) as ReadableStream, {status, headers: responseHeaders}));
        });
        request.on("error", reject);
        request.end();
    });
}
