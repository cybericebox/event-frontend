import {z} from "zod";
import {manageApiError} from "@/api/manage";
import {requireApiOrigin} from "@/utils/origins";
import {t} from "@/i18n/t";

// «Реєстри образів» in «Панель заходу»: the registry credentials of one event
// (used only for this event's labs) and which task images cannot start.
// The token is write-only: no response carries it, the form never reads it back.

const secretSchema = z.object({
    ID: z.string(), Host: z.string(), RepositoryPrefix: z.string().nullish().transform(value => value ?? ""),
    Username: z.string(), UpdatedAt: z.string().nullish().transform(value => value ?? ""),
});
export type RegistrySecret = z.infer<typeof secretSchema>;

export const unavailableReasons = ["not_configured", "not_found", "unauthorized", "unreachable", "needs_event_secret", "invalid_reference", "credential_conflict"] as const;
export type UnavailableReason = typeof unavailableReasons[number];

const unavailableSchema = z.object({Image: z.string(), Status: z.string(), Reason: z.string().nullish().transform(value => value ?? "")});
export type UnavailableImage = z.infer<typeof unavailableSchema>;
const availabilitySchema = z.array(z.object({
    EventExerciseID: z.string(), ExerciseID: z.string(), ExerciseName: z.string().nullish().transform(value => value ?? ""),
    Unavailable: z.array(unavailableSchema).nullish().transform(value => value ?? []),
}));

// The text of a reason; an unknown code falls back to the generic line.
export function unavailableReasonText(reason: string): string {
    return t((unavailableReasons as readonly string[]).includes(reason) ? `manage.registries.reason.${reason}` : "manage.registries.reason.unknown");
}

// --- form ---

export type RegistrySecretForm = {host: string; prefix: string; username: string; token: string};
export type RegistrySecretInput = {Host: string; RepositoryPrefix: string; Username: string; Token: string};

export const emptyRegistrySecretForm: RegistrySecretForm = {host: "", prefix: "", username: "", token: ""};

export function registrySecretForm(secret: RegistrySecret | null): RegistrySecretForm {
    return secret ? {host: secret.Host, prefix: secret.RepositoryPrefix, username: secret.Username, token: ""} : emptyRegistrySecretForm;
}

// Docker Hub has several names for one registry; the server stores `docker.io`.
export function normalizeRegistryHost(host: string): string {
    const value = host.trim().toLowerCase();
    return value === "index.docker.io" || value === "registry-1.docker.io" ? "docker.io" : value;
}

export function registrySecretErrors(form: RegistrySecretForm, saved: RegistrySecret | null): Partial<Record<keyof RegistrySecretForm, string>> {
    const errors: Partial<Record<keyof RegistrySecretForm, string>> = {};
    const host = form.host.trim();
    if (!host) errors.host = t("manage.registries.validation.host");
    else if (/[\s/]/.test(host)) errors.host = t("manage.registries.validation.hostFormat");
    if (!form.username.trim()) errors.username = t("manage.registries.validation.username");
    if (!saved && !form.token) errors.token = t("manage.registries.validation.token");
    // The stored token belongs to the old host: a new host needs a new token.
    else if (saved && !form.token && host && normalizeRegistryHost(host) !== normalizeRegistryHost(saved.Host)) errors.token = t("manage.registries.validation.tokenOnHostChange");
    return errors;
}

export function registrySecretInput(form: RegistrySecretForm): RegistrySecretInput {
    return {Host: form.host.trim(), RepositoryPrefix: form.prefix.trim().replace(/^\/+|\/+$/g, ""), Username: form.username.trim(), Token: form.token};
}

// --- requests ---

async function request<T>(eventID: string, path: string, schema: z.ZodType<T>, method = "GET", body?: unknown): Promise<T> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/events/${encodeURIComponent(eventID)}/manage/${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: {Accept: "application/json", ...(body === undefined ? {} : {"Content-Type": "application/json"})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    if (!response.ok) throw await manageApiError(response);
    return z.object({Data: schema}).parse(await response.json()).Data;
}

export async function listRegistrySecrets(eventID: string): Promise<RegistrySecret[]> {
    return request(eventID, "registry-secrets", z.array(secretSchema).nullish().transform(value => value ?? []));
}

export async function createRegistrySecret(eventID: string, input: RegistrySecretInput): Promise<RegistrySecret> {
    return request(eventID, "registry-secrets", secretSchema, "POST", input);
}

export async function updateRegistrySecret(eventID: string, secretID: string, input: RegistrySecretInput): Promise<RegistrySecret> {
    return request(eventID, `registry-secrets/${encodeURIComponent(secretID)}`, secretSchema, "PUT", input);
}

export async function deleteRegistrySecret(eventID: string, secretID: string): Promise<void> {
    await request(eventID, `registry-secrets/${encodeURIComponent(secretID)}`, z.unknown(), "DELETE");
}

// Only the attachments with at least one unavailable image, keyed by the event exercise id.
export async function getImageAvailability(eventID: string): Promise<Map<string, UnavailableImage[]>> {
    const items = await request(eventID, "images/availability", availabilitySchema.nullish().transform(value => value ?? []));
    return new Map(items.filter(item => item.Unavailable.length > 0).map(item => [item.EventExerciseID, item.Unavailable]));
}
