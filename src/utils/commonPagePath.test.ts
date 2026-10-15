import {describe,expect,it} from "vitest";
import {commonPageSlug} from "./commonPagePath";
describe("common render boundary",()=>{
    it("includes only landing and valid custom page slugs",()=>{
        expect(commonPageSlug("/")).toBe("");expect(commonPageSlug("/faq")).toBe("faq");expect(commonPageSlug("/p/faq")).toBe("faq");
        for(const path of ["/challenges","/scoreboard","/team","/teams","/forms","/join","/invite","/manage/content","/live","/vpn","/cabinet","/participation","/bad/route"]) expect(commonPageSlug(path)).toBeNull();
    });
});
