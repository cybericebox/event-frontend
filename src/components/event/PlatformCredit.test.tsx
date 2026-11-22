// @vitest-environment jsdom
import {render} from "@testing-library/react";
import {expect, it} from "vitest";
import {PlatformCredit} from "@/components/event/PlatformCredit";

it("carries the plain credit and the department line as twins, each under its own cfg class, the line with its links", () => {
    const {container} = render(<PlatformCredit />);
    const plain = container.querySelector(".cfg-ice-support-off");
    const line = container.querySelector(".cfg-ice-support");
    expect(plain?.textContent).toMatch(/Cyber.*ICE.*Box/);
    expect(plain?.querySelector("a")).toBeNull();
    expect(line?.querySelectorAll("a").length).toBeGreaterThan(0);
    expect(line?.textContent).toMatch(/Cyber.*ICE.*Box/);
});
