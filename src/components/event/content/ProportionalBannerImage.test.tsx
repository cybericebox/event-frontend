import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import {ProportionalBannerImage} from "./ProportionalBannerImage";
it("reserves the actual banner ratio in the initial HTML before downloading the image",()=>{
    const html=renderToStaticMarkup(<ProportionalBannerImage src="/banner.png" alt="Banner" eager dimensions={{Width:1600,Height:640}} />);
    expect(html).toContain('width="1600"');expect(html).toContain('height="640"');
    expect(html).toContain('fetchPriority="high"');
});
