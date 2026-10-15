import {z} from "zod";
import {PublicEventInfoSchema} from "@/types/publicEventInfo";
import {ContentDocumentSchema, ContentValueSchema} from "@/types/eventContent";
import {HardCache} from "@/utils/server/commonPageCache";
import type {RenderClaims} from "@/utils/server/eventRenderGrant";
import type {PublicResponse} from "./publicFetch";

const pageSchema = z.object({Slug:z.string(),Title:z.string()});
const manifestSchema = z.object({Event:PublicEventInfoSchema, Revision:z.string().min(1).max(256), Audience:z.enum(["public","staff"]), Page:pageSchema, CacheUntil:z.number().int()});
const bundleSchema = z.object({Event:PublicEventInfoSchema, Revision:z.string(), Page:pageSchema.extend({Document:ContentDocumentSchema}), Variables:z.record(z.string(),ContentValueSchema)});
export type CommonManifest = z.infer<typeof manifestSchema>;
export type CommonBundle = z.infer<typeof bundleSchema>;
export type ReadContext = {origin:string; token?:string; claims:RenderClaims|null};
type Api = (path:string, context:ReadContext) => Promise<PublicResponse>;
export class RenderReadError extends Error {
    constructor(readonly status:number, readonly requestId?:string) {super(`Event render request failed: ${status}`);}
}

export class CommonPageStore {
    private manifests:HardCache<CommonManifest|null>;
    private bundles:HardCache<CommonBundle>;
    constructor(private api:Api, private now = Date.now) {
        this.manifests = new HardCache({maxEntries:2048,maxBytes:8*1024*1024,ttl:1000,now});
        this.bundles = new HardCache({maxEntries:256,maxBytes:64*1024*1024,ttl:300_000,now});
    }
    private key(context:ReadContext, slug:string) {return JSON.stringify([context.origin,context.claims?.preview ? "staff":"public",slug,context.claims ? "granted":"anonymous"]);}
    private alive(context:ReadContext) {return !context.claims || context.claims.exp*1000>this.now();}
    async manifest(context:ReadContext,slug:string):Promise<CommonManifest|null> {
        if (!this.alive(context)) return null;
        try {
            const manifest = await this.manifests.get(this.key(context,slug),async () => {
                const response = await this.api(`/api/events/self/render-manifest?page=${encodeURIComponent(slug)}`,context);
                // Only anonymous, normalized absence is briefly reusable; signed denial and errors are never cached.
                if (response.status === 404 && !context.claims) return {value:null};
                if (response.status !== 200) throw new RenderReadError(response.status,response.requestId);
                const value = z.object({Data:manifestSchema}).parse(response.body).Data;
                if (value.Page.Slug !== slug || value.CacheUntil <= this.now()) throw new RenderReadError(502);
                return {value,validUntil:value.CacheUntil};
            });
            if (!manifest || !this.alive(context) || manifest.CacheUntil<=this.now()) return null;
            if (manifest.Audience !== (context.claims?.preview ? "staff":"public")) return null;
            if (context.claims && context.claims.event_id!==manifest.Event.EventID) return null;
            return manifest;
        } catch (error) {
            if (error instanceof RenderReadError && [401,403,404].includes(error.status)) return null;
            throw error;
        }
    }
    async page(context:ReadContext,slug:string):Promise<CommonBundle|null> {
        for (let attempt=0;attempt<2;attempt++) {
            const manifest=await this.manifest(context,slug);
            if (!manifest) return null;
            const key=JSON.stringify([context.origin,manifest.Event.EventID,slug,manifest.Revision,manifest.Audience,process.env.NEXT_DEPLOYMENT_ID ?? "current"]);
            try {
                const bundle=await this.bundles.get(key,async () => {
                    const response=await this.api(`/api/events/self/render-page?page=${encodeURIComponent(slug)}&revision=${encodeURIComponent(manifest.Revision)}`,context);
                    if (response.status!==200) throw new RenderReadError(response.status,response.requestId);
                    const value=z.object({Data:bundleSchema}).parse(response.body).Data;
                    if (value.Revision!==manifest.Revision || value.Event.EventID!==manifest.Event.EventID || value.Page.Slug!==slug) throw new RenderReadError(409);
                    return {value};
                });
                if (!this.alive(context)) return null;
                // Recheck if a slow cold bundle outlived the manifest's permission deadline.
                if (manifest.CacheUntil<=this.now()) {
                    this.manifests.delete(this.key(context,slug));
                    const fresh=await this.manifest(context,slug);
                    if (!fresh) return null;
                    if (fresh.Revision!==manifest.Revision) continue;
                }
                return bundle;
            } catch (error) {
                if (error instanceof RenderReadError && [401,403,404].includes(error.status)) {this.manifests.delete(this.key(context,slug));return null;}
                if (error instanceof RenderReadError && error.status===409) {this.manifests.delete(this.key(context,slug));continue;}
                throw error;
            }
        }
        throw new RenderReadError(409);
    }
}
