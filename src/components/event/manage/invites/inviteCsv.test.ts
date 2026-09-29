import {describe, expect, it} from "vitest";
import {csvTemplate, inviteColumns, parseInviteCsv, parseTeamCsv, readCsvLines, teamColumns} from "./inviteCsv";
import {addChips, splitAddresses} from "./emailChips";

describe("invitation CSV", () => {
    it("matches columns by English header in any case and order, ignoring unknown ones", () => {
        const csv = '\uFEFFLast_Name,Phone,EMAIL,first_name\r\n"Коваль, Олена",1,Olena@Example.test,Олена\r\nМельник,2,ivan@example.test,Іван\r\n';
        expect(parseInviteCsv(csv)).toEqual({issues: [], entries: [
            {email: "olena@example.test", firstName: "Олена", lastName: "Коваль, Олена", row: 2},
            {email: "ivan@example.test", firstName: "Іван", lastName: "Мельник", row: 3},
        ]});
    });

    it("reads semicolon files and reports issues with file rows", () => {
        const csv = "email;first_name\nnot-an-email;A\n;B\n\"a@example.test\";\"multi\nline\"\nb@example.test;C\n";
        const result = parseInviteCsv(csv);
        expect(result.issues).toEqual([{row: 2, code: "invalidEmail", value: "not-an-email"}, {row: 3, code: "missingEmail"}]);
        expect(result.entries.map(entry => [entry.email, entry.row])).toEqual([["a@example.test", 4], ["b@example.test", 6]]);
    });

    it("requires the email column", () => {
        expect(parseInviteCsv("name\nOlena\n").issues).toEqual([{row: 1, code: "missingColumn", column: "email"}]);
        expect(parseInviteCsv("").issues).toEqual([{row: 1, code: "empty"}]);
    });

    it("keeps quoted delimiters inside cells", () => {
        expect(readCsvLines('a,b\n"x, y","z ""q"""\n')[1].cells).toEqual(["x, y", 'z "q"']);
    });
});

describe("team CSV", () => {
    it("groups rows by team and takes the marked captain", () => {
        const csv = "team,email,first_name,last_name,captain\nBlue,a@example.test,A,One,так\nblue,b@example.test,B,Two,\nRed,c@example.test,C,Three,X\n";
        const {teams, issues} = parseTeamCsv(csv);
        expect(issues).toEqual([]);
        expect(teams.map(team => [team.name, team.captainEmail, team.members.map(member => member.email)])).toEqual([
            ["Blue", "a@example.test", ["a@example.test", "b@example.test"]],
            ["Red", "c@example.test", ["c@example.test"]],
        ]);
    });

    it("needs exactly one captain per team and known marks", () => {
        const csv = "captain,team,email\nyes,Blue,a@example.test\n1,Blue,b@example.test\n,Red,c@example.test\nmaybe,Red,d@example.test\n,Green,a@example.test\n,,e@example.test\n";
        expect(parseTeamCsv(csv).issues).toEqual([
            {row: 3, code: "manyCaptains", value: "Blue"},
            {row: 4, code: "noCaptain", value: "Red"},
            {row: 5, code: "captainMark", value: "maybe"},
            {row: 6, code: "duplicateEmail", value: "a@example.test"},
            {row: 7, code: "missingTeam"},
        ]);
    });

    it("reports missing required columns", () => {
        expect(parseTeamCsv("email,team\na@example.test,Blue\n").issues).toEqual([{row: 1, code: "missingColumn", column: "captain"}]);
    });

    it("builds a template with a BOM, the header and quoted example rows", () => {
        expect(csvTemplate(["team", "email"], [["Blue, Red", "a@example.test"], ["Blue, Red", "b@example.test"]]))
            .toBe('\uFEFFteam,email\r\n"Blue, Red",a@example.test\r\n"Blue, Red",b@example.test\r\n');
    });

    it("rejects the unchanged template rows instead of inviting example.com", () => {
        const team = csvTemplate(teamColumns, [["Команда 1", "olena.koval@example.com", "Олена", "Коваль", "так"], ["Команда 1", "ivan.melnyk@example.com", "Іван", "Мельник", ""]]);
        expect(parseTeamCsv(team)).toEqual({teams: [], issues: [{row: 2, code: "exampleRow"}, {row: 3, code: "exampleRow"}]});
        const invite = csvTemplate(inviteColumns, [["olena.koval@example.com", "Олена", "Коваль"]]) + "real@school.test,Ann,Lee\r\n";
        const parsed = parseInviteCsv(invite);
        expect(parsed.issues).toEqual([{row: 2, code: "exampleRow"}]);
        expect(parsed.entries.map(entry => entry.email)).toEqual(["real@school.test"]);
    });
});

describe("email chips", () => {
    it("splits on commas, semicolons, spaces and newlines", () => {
        expect(splitAddresses(" A@x.test, b@x.test;c@x.test\nd@x.test\t e ")).toEqual(["a@x.test", "b@x.test", "c@x.test", "d@x.test", "e"]);
    });

    it("skips case-insensitive repeats, fills missing names and marks invalid addresses", () => {
        const chips = addChips([], [{email: "A@x.test"}, {email: "bad"}]);
        expect(addChips(chips, [{email: "a@X.test", firstName: "Olena", lastName: "Koval"}, {email: "bad"}])).toEqual([
            {email: "a@x.test", firstName: "Olena", lastName: "Koval", valid: true},
            {email: "bad", firstName: "", lastName: "", valid: false},
        ]);
    });
});
