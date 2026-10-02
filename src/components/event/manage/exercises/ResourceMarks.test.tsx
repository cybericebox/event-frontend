// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {cleanup, render} from "@testing-library/react";
import {NoAgentFitsTag, ResourceHeavyTag, ResourcesLine} from "./ResourceMarks";

afterEach(cleanup);

describe("resource marks", () => {
    it("shows the badge only for an approved elevation", () => {
        expect(render(<ResourceHeavyTag show />).container.textContent).toBe("Ресурсоємне");
        cleanup();
        expect(render(<ResourceHeavyTag show={false} />).container.firstChild).toBeNull();
    });

    it("marks a set no laboratory can run", () => {
        expect(render(<NoAgentFitsTag show />).container.textContent).toBe("Немає лабораторії для запуску");
        cleanup();
        expect(render(<NoAgentFitsTag show={false} />).container.firstChild).toBeNull();
    });

    it("shows the total of a set and nothing without devices", () => {
        const one = {CPUMillicores: 125, MemoryBytes: 512 * 1024 ** 2, Devices: 2};
        expect(render(<ResourcesLine resources={{Min: one, Max: one}} />).container.textContent).toBe("CPU 125m · памʼять 512Mi · пристроїв 2");
        cleanup();
        expect(render(<ResourcesLine resources={null} />).container.firstChild).toBeNull();
        cleanup();
        const none = {CPUMillicores: 0, MemoryBytes: 0, Devices: 0};
        expect(render(<ResourcesLine resources={{Min: none, Max: none}} />).container.firstChild).toBeNull();
    });
});
