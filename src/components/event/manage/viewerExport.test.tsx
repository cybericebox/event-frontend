// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import type {ReactNode} from "react";
import {t} from "@/i18n/t";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {ManagerContext} from "./managerContext";
import {AnalyticsExportButton} from "./analytics/AnalyticsExportButton";
import {CsvButton} from "./analytics/progress/CsvButton";
import {AnalyticsTableExport} from "./analytics/AnalyticsBlock";

afterEach(cleanup);

const event = {EventID: "event-1", Name: "Захід"} as PublicEventInfo;
const period = {from: null, to: null};
const panel = (canManage: boolean, children: ReactNode) => <ManagerContext.Provider value={{event, canManage}}>{children}</ManagerContext.Provider>;
const exports = () => <>
    <AnalyticsExportButton eventID="event-1" section="overview" period={period} />
    <CsvButton eventID="event-1" path="analytics/progress/matrix/export.csv" name="analytics-progress" />
    <AnalyticsTableExport eventID="event-1" section="participants" table={"registrations" as never} period={period} />
</>;

// Owner decision (2026-10-19): a viewer (observer) exports nothing; the API refuses it too.
describe("exports in the panel", () => {
    it("are hidden from a viewer", () => {
        render(panel(false, exports()));
        expect(screen.queryAllByRole("button", {name: new RegExp(t("manage.analytics.export"))})).toHaveLength(0);
    });

    it("stay for an owner or a write moderator", () => {
        render(panel(true, exports()));
        expect(screen.getAllByRole("button", {name: new RegExp(t("manage.analytics.export"))})).toHaveLength(3);
    });
});
