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
const panel = (canManage: boolean, canExport: boolean, children: ReactNode) => <ManagerContext.Provider value={{event, canManage, canExport}}>{children}</ManagerContext.Provider>;
const exports = () => <>
    <AnalyticsExportButton eventID="event-1" section="overview" period={period} />
    <CsvButton eventID="event-1" path="analytics/progress/matrix/export.csv" name="analytics-progress" />
    <AnalyticsTableExport eventID="event-1" section="participants" table={"registrations" as never} period={period} />
</>;

// Owner rulings (2026-10-19): a viewer or an admin viewer exports nothing; the owner, write moderators and platform
// admins do. The panel follows CanExport of /manage/access, the API refuses the rest too.
describe("exports in the panel", () => {
    const buttons = () => screen.queryAllByRole("button", {name: new RegExp(t("manage.analytics.export"))});

    it("are hidden from a viewer and an admin viewer", () => {
        render(panel(false, false, exports()));
        expect(buttons()).toHaveLength(0);
    });

    it("stay for an owner or a write moderator", () => {
        render(panel(true, true, exports()));
        expect(buttons()).toHaveLength(3);
    });

    it("stay for a platform admin, who reads the panel without a role in the event", () => {
        render(panel(false, true, exports()));
        expect(buttons()).toHaveLength(3);
    });

    it("are hidden outside the panel", () => {
        render(exports());
        expect(buttons()).toHaveLength(0);
    });
});
