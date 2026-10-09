import {expect, it} from "vitest";
import {decimalCpu, decimalMemory} from "./resourceObservationModel";
it("keeps unsafe integers exact without numeric rounding", () => {
    expect(decimalCpu("9007199254740993")).toContain("9 007 199 254 740 993");
    expect(decimalMemory("9007199254740993")).toContain("9 007 199 254 740 993");
    expect(decimalCpu("500")).toBe("500 мілі-ядер");
    expect(decimalMemory("1024")).toBe("1 КіБ");
});

it("preserves exact digits even for safe integers that compact formatting would round", () => {
    expect(decimalCpu("1001")).toBe("1 001 mCPU");
    expect(decimalMemory("104857601")).toBe("104 857 601 Б");
});
