// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {cleanup, render, screen, within} from "@testing-library/react";
import {AnalyticsCommunicationsSchema} from "@/api/manageAnalyticsPeople";
import {AnalyticsFunnels} from "./AnalyticsFunnels";
import {formatDuration} from "./analyticsFormat";

afterEach(cleanup);

const funnels = {
    Invitations: {Sent: 12, Accepted: 9, AcceptRate: 0.75, MedianAcceptSeconds: 12000},
    Registration: {Started: 9, Completed: 6, CompletionRate: 0.6667},
    Applications: {Submitted: 20, Decided: 15, Approved: 12, Rejected: 3, DecidedRate: 0.75, ApprovedRate: 0.8, RejectedRate: 0.2, MedianDecisionSeconds: 187200},
};

describe("Воронки комунікацій", () => {
    it("shows stage numbers, conversion and median of every card", () => {
        render(<AnalyticsFunnels funnels={AnalyticsCommunicationsSchema.shape.Funnels.parse(funnels)!} />);
        const invitations = within(screen.getByTestId("funnel-invitations"));
        expect(invitations.getByText("75%")).toBeTruthy();
        expect(invitations.getByText("12")).toBeTruthy();
        expect(invitations.getByText("9")).toBeTruthy();
        expect(invitations.getByText("Медіанний час: 3 год 20 хв")).toBeTruthy();
        const registration = within(screen.getByTestId("funnel-registration"));
        expect(registration.getByText("67%")).toBeTruthy();
        const applications = within(screen.getByTestId("funnel-applications"));
        expect(applications.getByText("Схвалено: 80%")).toBeTruthy();
        expect(applications.getByText("Відхилено: 20%")).toBeTruthy();
        expect(applications.getByText("Медіанний час: 2 д 4 год")).toBeTruthy();
        expect(screen.getAllByRole("button", {name: /Про поле/}).length).toBe(3);
    });

    it("shows a dash for null rates and medians", () => {
        const empty = AnalyticsCommunicationsSchema.shape.Funnels.parse({
            Invitations: {Sent: 0, Accepted: 0, AcceptRate: null, MedianAcceptSeconds: null},
            Registration: {Started: 0, Completed: 0, CompletionRate: null},
            Applications: {Submitted: 0, Decided: 0, Approved: 0, Rejected: 0, DecidedRate: null, ApprovedRate: null, RejectedRate: null, MedianDecisionSeconds: null},
        })!;
        render(<AnalyticsFunnels funnels={empty} />);
        expect(within(screen.getByTestId("funnel-invitations")).getByText("—")).toBeTruthy();
        expect(within(screen.getByTestId("funnel-invitations")).getByText("Медіанний час: —")).toBeTruthy();
        expect(within(screen.getByTestId("funnel-applications")).getByText("Схвалено: —")).toBeTruthy();
    });

    it("formats durations humanely", () => {
        expect(formatDuration(45)).toBe("45 с");
        expect(formatDuration(720)).toBe("12 хв");
        expect(formatDuration(12000)).toBe("3 год 20 хв");
        expect(formatDuration(187200)).toBe("2 д 4 год");
        expect(formatDuration(172800)).toBe("2 д");
    });
});
