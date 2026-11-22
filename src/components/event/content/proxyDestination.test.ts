import {expect,it} from "vitest";
import {matchesProxyDestination,proxyDestinationNext} from "./proxyDestination";
const auth="https://lab.test/_auth";
it("returns the exact relative path/query/fragment, or / without a destination",()=>{
 expect(proxyDestinationNext(auth,"https://lab.test/panel?x=1&y=2#details")).toBe("/panel?x=1&y=2#details");
 expect(proxyDestinationNext(auth,"https://lab.test/")).toBe("/");
 expect(proxyDestinationNext(auth)).toBe("/");
});
it.each(["https://docs.test/?device=https://lab.test","https://lab.test//outside","https://lab.test/%2f%2foutside","https://lab.test/panel?x=%5c","https://lab.test/panel?x=%0a","https://lab.test/_auth","https://lab.test/_auth/","https://lab.test/%5fauth","https://lab.test/path/../_auth","https://lab.test/panel?x=%bad"])("refuses unsafe or wrong-device destination %s",value=>{
 expect(()=>proxyDestinationNext(auth,value)).toThrow();
});
it("distinguishes a device destination from a URL that merely mentions the device",()=>{
 expect(matchesProxyDestination("https://lab.test/panel","https://lab.test/")).toBe(true);
 expect(matchesProxyDestination("https://docs.test/?device=https://lab.test","https://lab.test")).toBe(false);
});
