// @vitest-environment jsdom
import {cleanup, render, screen, fireEvent} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import type {OwnTeam} from "@/api/clientAuth";
import {t} from "@/i18n/t";
import {FormationCard} from "./TeamPage";

vi.mock("echarts-for-react", () => ({default: () => <div data-testid="chart" />}));
vi.mock("next/link", () => ({default: ({href, children, ...rest}: {href: string; children: ReactNode}) => <a href={href} {...rest}>{children}</a>}));

afterEach(cleanup);

const team = {ID: "00000000-0000-4000-8000-000000000001", Name: "Blue", MemberCount: 2, Role: 0, ExtraFields: {}} as OwnTeam;

describe("FormationCard", () => {
    it("lets the captain confirm the roster when the server allows it", () => {
        const onForm = vi.fn();
        render(<FormationCard team={team} captain formed={false} form={{Allowed: true, Reason: ""}} onForm={onForm} />);
        fireEvent.click(screen.getByRole("button", {name: t("participation.team.form")}));
        expect(onForm).toHaveBeenCalledTimes(1);
    });

    it("explains why the captain cannot confirm yet", () => {
        render(<FormationCard team={team} captain formed={false} form={{Allowed: false, Reason: "below_minimum"}} onForm={vi.fn()} />);
        expect(screen.queryByRole("button")).toBeNull();
        expect(screen.getByText(t("participation.reason.below_minimum"))).toBeTruthy();
    });

    it("tells a member the roster is not confirmed", () => {
        render(<FormationCard team={{...team, Role: 1}} captain={false} formed={false} form={{Allowed: false, Reason: "not_captain"}} onForm={vi.fn()} />);
        expect(screen.queryByRole("button")).toBeNull();
        expect(screen.getByText(t("participation.team.statusOpen"))).toBeTruthy();
    });

    it("omits an already-formed denial instead of repeating the team status", () => {
        const {container} = render(<FormationCard team={team} captain formed={false} form={{Allowed: false, Reason: "team_formed"}} onForm={vi.fn()} />);
        expect(container.textContent).toBe("");
    });

    it("omits a separate confirmation card once the roster is fixed",()=>{
        const {container}=render(<FormationCard team={{...team,Formed:true}} captain formed form={undefined} onForm={vi.fn()}/>);
        expect(container.textContent).toBe("");
    });
});
