import {z} from "zod";
import {PublicEventInfoSchema} from "@/types/publicEventInfo";
import {ContentDocumentSchema, ContentValueSchema} from "@/types/eventContent";
import {HardCache} from "@/utils/server/commonPageCache";
import type {RenderClaims} from "@/utils/server/eventRenderGrant";
import type {PublicResponse} from "./publicFetch";

const pageSchema = z.object({Slug:z.string(),Title:z.string()});
const manifestSchema = z.object({Event:PublicEventInfoSchema, Revision:z.string().min(1).max(256), Audience:z.enum(["public","staff"]), Page:pageSchema, CacheUntil:z.number().int()});
const bundleSchema = z.object({Event:PublicEventInfoSchema, Revision:z.string(), Page:pageSchema.extend({Document:ContentDocumentSchema}), Variables:z.record(z.string(),ContentValueSchema),Images:z.record(z.string(),z.object({Width:z.number().int().positive(),Height:z.number().int().positive()})).default({})});
export type CommonManifest = z.infer<typeof manifestSchema>;
export type CommonBundle = z.infer<typeof bundleSchema>;
export type CommonValues = CommonBundle["Variables"];
export type ReadContext = {origin:string; token?:string; claims:RenderClaims|null};
type Api = (path:string, context:ReadContext) => Promise<PublicResponse>;
export class RenderReadError extends Error {
    constructor(readonly status:number, readonly requestId?:string) {super(`Event render request failed: ${status}`);}
}

export class CommonPageStore {
    private manifests:HardCache<CommonManifest|null>;
    private bundles:HardCache<CommonBundle>;
    private liveValues:HardCache<{Revision:string;Variables:CommonValues}>;
    constructor(private api:Api, private now = Date.now) {
        this.manifests = new HardCache({maxEntries:2048,maxBytes:8*1024*1024,ttl:1000,now});
        this.bundles = new HardCache({maxEntries:256,maxBytes:64*1024*1024,ttl:300_000,now});
        this.liveValues = new HardCache({maxEntries:256,maxBytes:8*1024*1024,ttl:30_000,now});
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
    page(context:ReadContext,slug:string):Promise<CommonBundle|null> {
        return this.read(context,slug,this.bundles,value=>value);
    }
    values(context:ReadContext,slug:string,eventID:string):Promise<{Revision:string;Variables:CommonValues}|null> {
        // Same published PUBLIC projection for both audiences, independent of the document snapshot.
        return this.read(context,slug,this.liveValues,value=>({Revision:value.Revision,Variables:value.Variables}),eventID);
    }
    private async read<T>(context:ReadContext,slug:string,cache:HardCache<T>,project:(bundle:CommonBundle)=>T,eventID?:string):Promise<T|null> {
        for (let attempt=0;attempt<2;attempt++) {
            const manifest=await this.manifest(context,slug);
            if (!manifest || (eventID && manifest.Event.EventID!==eventID)) return null;
            const key=JSON.stringify([context.origin,manifest.Event.EventID,slug,manifest.Revision,manifest.Audience,process.env.NEXT_DEPLOYMENT_ID ?? "current"]);
            try {
                const value=await cache.get(key,async () => {
                    const response=await this.api(`/api/events/self/render-page?page=${encodeURIComponent(slug)}&revision=${encodeURIComponent(manifest.Revision)}`,context);
                    if (response.status!==200) throw new RenderReadError(response.status,response.requestId);
                    const value=z.object({Data:bundleSchema}).parse(response.body).Data;
                    if (value.Revision!==manifest.Revision || value.Event.EventID!==manifest.Event.EventID || value.Page.Slug!==slug) throw new RenderReadError(409);
                    return {value:project(value)};
                });
                if (!this.alive(context)) return null;
                // A slow fill must not outlive visibility, event binding or the reader's grant.
                if (manifest.CacheUntil<=this.now()) {
                    this.manifests.delete(this.key(context,slug));
                    const fresh=await this.manifest(context,slug);
                    if (!fresh) return null;
                    if (fresh.Revision!==manifest.Revision || fresh.Event.EventID!==manifest.Event.EventID || fresh.Audience!==manifest.Audience) continue;
                }
                return value;
            } catch (error) {
                if (error instanceof RenderReadError && [401,403,404].includes(error.status)) {this.manifests.delete(this.key(context,slug));return null;}
                if (error instanceof RenderReadError && error.status===409) {this.manifests.delete(this.key(context,slug));continue;}
                throw error;
            }
        }
        throw new RenderReadError(409);
    }
}
