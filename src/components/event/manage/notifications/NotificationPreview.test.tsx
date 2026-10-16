// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {NotificationPreview} from "./NotificationPreview";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import type {ManageInAppTemplateInput} from "@/api/manageNotifications";
afterEach(cleanup);
HTMLDialogElement.prototype.showModal ??= function () {this.setAttribute("open", "")};
HTMLDialogElement.prototype.close ??= function () {this.removeAttribute("open")};
const template: ManageInAppTemplateInput = {NotificationType: "broadcast", Title: "Message", Body: "Body", Link: "", Icon: "bell", Tone: "neutral", AccentColor: "", Surface: "", AutoDismissMs: null, Actions: [], Dismissible: true};
const event = {EventID: "e", Name: "CTF"} as PublicEventInfo;
function wrap(node: React.ReactNode) {return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>{node}</QueryClientProvider>)}
describe("notification preview channels", () => {
 it("shows one accessible panel, supports keyboard tabs and preserves device selection", () => {
  wrap(<NotificationPreview email={{event, input: null}} inApp={{template, values: {}}} />);
  expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["Лист", "Стрічка сповіщень", "Спливаюче повідомлення"]);
  expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", {name: /Телефон/}));
  fireEvent.keyDown(screen.getByRole("tab", {name: "Лист"}), {key: "ArrowRight"});
  expect(document.activeElement).toBe(screen.getByRole("tab", {name: "Стрічка сповіщень"}));
  expect(screen.getByRole("tabpanel").querySelector(".event-notifications__list")).toBeTruthy();
  expect(screen.getByRole("tabpanel").querySelector(".event-notification-popin")).toBeNull();
  fireEvent.keyDown(document.activeElement!, {key: "End"});
  expect(screen.getByRole("tabpanel").querySelector(".event-notification-popin")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", {name: "Лист"}));
  expect(screen.getByRole("button", {name: /Телефон/}).getAttribute("aria-pressed")).toBe("true");
 });
 it("expands the current channel and returns to the same selection on close", () => {
  wrap(<NotificationPreview inApp={{template, values: {}}} />);
  fireEvent.click(screen.getByRole("tab", {name: "Спливаюче повідомлення"}));
  fireEvent.click(screen.getByRole("button", {name: "Розгорнути перегляд"}));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("tab", {name: "Спливаюче повідомлення"}).getAttribute("aria-selected")).toBe("true");
  fireEvent.click(within(dialog).getByRole("tab", {name: "Стрічка сповіщень"}));
  fireEvent.click(within(dialog).getByRole("button", {name: "Закрити"}));
  expect(screen.getByRole("tab", {name: "Стрічка сповіщень"}).getAttribute("aria-selected")).toBe("true");
 });
 it("limits channels to the data and recovers selection when a channel is removed", () => {
  const {rerender} = wrap(<NotificationPreview email={{event, input: null}} inApp={{template, values: {}}} />);
  fireEvent.click(screen.getByRole("tab", {name: "Спливаюче повідомлення"}));
  rerender(<QueryClientProvider client={new QueryClient()}><NotificationPreview email={{event, input: null}} /></QueryClientProvider>);
  expect(screen.getAllByRole("tab")).toHaveLength(1);
  expect(screen.getByRole("tab", {name: "Лист"}).getAttribute("aria-selected")).toBe("true");
  expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
 });
});
