// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {AttachmentDownload} from "./AttachmentDownload";
afterEach(() => {cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();});
it("whole filename row downloads with cookies and preserves filename without exposing API URL", async () => {
 const fetch = vi.fn().mockResolvedValue({ok:true, blob:async () => new Blob(["file"])}); vi.stubGlobal("fetch",fetch);
 const create = vi.fn(() => "blob:attachment"); Object.defineProperty(URL,"createObjectURL",{configurable:true,value:create}); Object.defineProperty(URL,"revokeObjectURL",{configurable:true,value:vi.fn()});
 let filename = ""; let href = ""; vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(function(this: HTMLAnchorElement){filename=this.download; href=this.href;});
 render(<AttachmentDownload url="https://api.test/private/route" name="capture.pcap" size={128} />);
 const row=screen.getByRole("button",{name:/capture.pcap/}); expect(row.hasAttribute("href")).toBe(false); expect(document.querySelector("a")).toBeNull();
 await act(async () => {fireEvent.click(row);});
 expect(fetch).toHaveBeenCalledWith("https://api.test/private/route", {credentials:"include",cache:"no-store"}); expect(filename).toBe("capture.pcap"); expect(href).toBe("blob:attachment");
});
it("keeps failure with the file row and permits retry", async () => {
 vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("network")));
 render(<AttachmentDownload url="https://api.test/file" name="task.zip" size={0}/>);
 await act(async () => {fireEvent.click(screen.getByRole("button",{name:/task.zip/}));});
 expect(screen.getByRole("alert").textContent).toContain("Не вдалося завантажити файл"); expect(screen.getByRole("button",{name:/task.zip/}).hasAttribute("disabled")).toBe(false);
});
it("keeps each filename identifiable during concurrent downloads and leaves other files available", async () => {
 let reject!: (reason: Error) => void;
 vi.stubGlobal("fetch",vi.fn(() => new Promise((_resolve, fail) => {reject=fail;})));
 render(<><AttachmentDownload url="https://api.test/a" name="capture.pcap" size={128}/><AttachmentDownload url="https://api.test/b" name="notes.txt" size={256}/></>);
 fireEvent.click(screen.getByRole("button",{name:/capture.pcap/}));
 const downloading=screen.getByRole("button",{name:/capture.pcap/});
 expect(downloading.getAttribute("aria-busy")).toBe("true");
 expect(downloading.textContent).toContain("Завантажуємо…");
 expect(downloading.hasAttribute("disabled")).toBe(true);
 expect(screen.getByRole("button",{name:/notes.txt/}).hasAttribute("disabled")).toBe(false);
 await act(async () => {reject(new Error("network"));});
 expect(screen.getByRole("button",{name:/capture.pcap/}).hasAttribute("disabled")).toBe(false);
});
