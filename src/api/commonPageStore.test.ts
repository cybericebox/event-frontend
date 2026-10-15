import {describe, expect, it, vi} from "vitest";
import {CommonPageStore} from "./commonPageStore";
const event = {EventID:"33333333-3333-4333-8333-333333333333", Tag:"one", Name:"Published", StartTime:"2026-10-15T12:00:00Z", FinishTime:null, Status:1, Participation:null, Registration:0, CanViewResults:false, CanViewParticipants:false, PreviewDescription:"", PreviewPicture:"", Theme:{Version:1, Brand:"#112233", Accent:"#112233", AccentLight:"#112233", AccentDark:"#112233", AccentLive:"#112233"}};
const context = {origin:"https://one.example.test", token:undefined, claims:null};
const manifest = (revision: string, now: number) => ({Event:event, Revision:revision, Audience:"public", Page:{Slug:"",Title:"Landing"}, CacheUntil:now+1000});
const bundle = (revision: string) => ({Event:event, Revision:revision, Page:{Slug:"",Title:"Landing",Document:{blocks:[{id:"p", type:"text", text:revision}]}}, Variables:{}});
describe("authorized common page store", () => {
    it("shares a revision bundle but hard-revalidates access before using it", async () => {
        let now = 0; let revision = "r1"; let denied = false;
        const api = vi.fn(async (path: string) => {
            if (denied) return {status:404, body:null};
            return {status:200, body:{Data:path.includes("manifest") ? manifest(revision, now) : bundle(revision)}};
        });
        const store = new CommonPageStore(api, () => now);
        expect((await store.page(context, ""))?.Revision).toBe("r1");
        await store.page(context, ""); expect(api).toHaveBeenCalledTimes(2);
        now = 1001; await store.page(context, ""); expect(api).toHaveBeenCalledTimes(3);
        now = 2002; revision = "r2"; expect((await store.page(context, ""))?.Revision).toBe("r2");
        now = 3003; denied = true; expect(await store.page(context, "")).toBeNull();
    });
    it("never serves cached content after a gate outage or to another tenant", async () => {
        let now = 0;
        const api = vi.fn(async () => ({status:200,body:{Data:manifest("r1",now)}}));
        const store = new CommonPageStore(api, () => now);
        await store.manifest(context, ""); now = 1001;
        api.mockRejectedValue(new Error("outage"));
        await expect(store.manifest(context, "")).rejects.toThrow("outage");
        await expect(store.manifest({...context,origin:"https://two.example.test"}, "")).rejects.toThrow("outage");
    });
    it("checks grant expiry and event binding even on a warm shared staff cache", async () => {
        let now = 0;
        const api = vi.fn(async () => ({status:200,body:{Data:{...manifest("r1",now),Audience:"staff"}}}));
        const store = new CommonPageStore(api, () => now);
        const claims = {event_id:event.EventID,preview:true,exp:2};
        const staff = {...context,token:"one",claims} as Parameters<typeof store.manifest>[0];
        expect(await store.manifest(staff, "")).not.toBeNull();
        expect(await store.manifest({...staff,token:"two"}, "")).not.toBeNull();
        expect(api).toHaveBeenCalledTimes(1);
        expect(await store.manifest({...staff,claims:{...staff.claims!,event_id:"44444444-4444-4444-8444-444444444444"}}, "")).toBeNull();
        now = 2001; expect(await store.manifest(staff, "")).toBeNull();
    });
    it("rejects a bundle revision race and retries the manifest once", async () => {
        const api = vi.fn().mockResolvedValueOnce({status:200,body:{Data:manifest("r1",0)}}).mockResolvedValueOnce({status:409,body:null}).mockResolvedValueOnce({status:200,body:{Data:manifest("r2",0)}}).mockResolvedValueOnce({status:200,body:{Data:bundle("r2")}});
        expect((await new CommonPageStore(api,()=>0).page(context,""))?.Revision).toBe("r2");
        expect(api).toHaveBeenCalledTimes(4);
    });
});
