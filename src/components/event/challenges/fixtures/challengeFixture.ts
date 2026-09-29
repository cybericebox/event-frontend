import type {OwnChallenge} from "@/api/participantChallenges";

// A task that uses every formatting feature the catalog editor (exercises-frontend
// RichTextEditor: headings, bold/italic/underline/strike/inline code, code, links,
// bullet/numbered/nested lists, quotes, alignment) can produce, plus worst-case
// lengths. Tests render it; a later visual check can render the same object.
// Text format flags: 1 bold, 2 italic, 4 strike, 8 underline, 16 code.
const text = (value: string, format = 0) => ({type: "text", text: value, format, detail: 0, mode: "normal", style: "", version: 1});
const paragraph = (...children: object[]) => ({type: "paragraph", format: "", indent: 0, direction: "ltr", version: 1, children});
const heading = (tag: string, value: string) => ({type: "heading", tag, format: "", indent: 0, direction: "ltr", version: 1, children: [text(value)]});
const link = (url: string, value: string) => ({type: "link", url, rel: null, target: null, title: null, format: "", indent: 0, direction: "ltr", version: 1, children: [text(value)]});
const item = (value: number, ...children: object[]) => ({type: "listitem", value, format: "", indent: 0, direction: "ltr", version: 1, children});
const list = (listType: "bullet" | "number", ...children: object[]) => ({type: "list", listType, start: 1, tag: listType === "number" ? "ol" : "ul", format: "", indent: 0, direction: "ltr", version: 1, children});
const document = (...children: object[]) => ({root: {type: "root", format: "", indent: 0, direction: "ltr", version: 1, children}});

export const LONG_WORD = "Supercalifragilisticexpialidocious".repeat(6);
export const LONG_URL = "https://example.com/a/very/long/path/that/keeps/going/" + "segment-".repeat(30) + "end?token=" + "x".repeat(80);
export const LONG_CODE_LINE = "curl -s -H 'X-Forwarded-For: 127.0.0.1' 'http://10.10.10.5/api/v1/search?q=" + "A".repeat(140) + "' | jq .";
export const LONG_TITLE = "Дуже довга назва завдання, яка не вміщується в один рядок навіть у широкому вікні, і ще трохи " + LONG_WORD;
export const LONG_CATEGORY = "Веб-безпека та експлуатація вразливостей у застосунках " + LONG_WORD;

export const fixtureDescription = document(
    heading("h1", "Заголовок першого рівня"),
    heading("h2", "Заголовок другого рівня"),
    heading("h3", "Заголовок третього рівня"),
    heading("h4", "Заголовок четвертого рівня"),
    heading("h5", "Заголовок п'ятого рівня"),
    heading("h6", "Заголовок шостого рівня"),
    paragraph(text("Жирний ", 1), text("курсив ", 2), text("підкреслений ", 8), text("закреслений ", 4), text("код", 16), text(" і "), text("жирний курсив підкреслений", 1 | 2 | 8)),
    paragraph(text("Посилання: "), link("https://example.com/docs", "зовнішнє"), text(", "), link("/rules", "внутрішнє"), text(", "), link("javascript:alert(1)", "небезпечне"), text(", довге: "), link(LONG_URL, LONG_URL)),
    paragraph(text(LONG_WORD)),
    paragraph(),
    paragraph(text("Після порожнього абзацу.")),
    list("bullet", item(1, text("Перший пункт")), item(2, text("Другий пункт")), item(3, list("bullet", item(1, text("Вкладений пункт")), item(2, list("bullet", item(1, text("Ще глибше"))))))),
    list("number", item(1, text("Крок один")), item(2, text("Крок два")), item(3, list("number", item(1, text("Підкрок а")), item(2, text("Підкрок б")))), item(4, text("Крок три"))),
    {type: "quote", format: "", indent: 0, direction: "ltr", version: 1, children: [text("Цитата з "), text("виділенням", 1), text(" усередині.")]},
    {type: "code", language: null, format: "", indent: 0, direction: "ltr", version: 1, children: [
        text("function main() {"), {type: "linebreak", version: 1}, {type: "tab", text: "\t", format: 0, detail: 2, mode: "normal", style: "", version: 1},
        text("  return \"відступ зберігається\";"), {type: "linebreak", version: 1}, text("}"), {type: "linebreak", version: 1}, text(LONG_CODE_LINE),
    ]},
    {type: "code", language: null, format: "", indent: 0, direction: "ltr", version: 1, children: Array.from({length: 40}, (_, index) => [text(`line ${index + 1}: echo $((${index} * 2))`), {type: "linebreak", version: 1}]).flat().slice(0, -1)},
    {type: "paragraph", format: "center", indent: 0, direction: "ltr", version: 1, children: [text("Абзац по центру")]},
);

const hintDoc = (value: string, code: string) => JSON.stringify(document(
    paragraph(text(value, 1), text(" та "), text(code, 16)),
    list("bullet", item(1, text("пункт підказки")), item(2, list("number", item(1, text("вкладений"))))),
    {type: "quote", format: "", indent: 0, direction: "ltr", version: 1, children: [text("цитата в підказці")]},
    {type: "code", language: null, format: "", indent: 0, direction: "ltr", version: 1, children: [text(LONG_CODE_LINE)]},
    paragraph(link("https://example.com/hint", "довідка"), text(" "), text(LONG_WORD)),
));

export const fixtureChallenge: OwnChallenge = {
    ID: "11111111-1111-4111-8111-111111111111",
    EventChallengeID: "22222222-2222-4222-8222-222222222222",
    Snapshot: {
        name: LONG_TITLE,
        description: fixtureDescription,
        difficulty: "hard",
        attachments: [{file_id: "33333333-3333-4333-8333-333333333333", name: "very-long-attachment-name-" + "x".repeat(80) + ".zip"}],
    },
    Readiness: 100,
    SolvedAt: "2026-09-29T09:30:00Z",
    Points: 1250,
    Order: 1,
    GroupID: "44444444-4444-4444-8444-444444444444",
    GroupName: LONG_CATEGORY,
    GroupOrder: 1,
    ContentUpdatedAt: "2026-09-29T09:00:00Z",
    Infrastructure: true,
    HintsEnabled: true,
    Locked: false,
    Prerequisites: [],
    Files: [{FileID: "33333333-3333-4333-8333-333333333333", Name: "very-long-attachment-name-" + "x".repeat(80) + ".zip", Size: 123456}],
    SolveCount: 7,
    Hints: [
        {ID: "h1", Level: "nudge", Cost: 0, Unlocked: true, Content: hintDoc("Легка підказка", "nudge()"), UnlockedAt: "2026-09-29T09:12:00Z", UnlockedByName: "Андрій"},
        {ID: "h2", Level: "direction", Cost: 25, Unlocked: true, Content: hintDoc("Напрямок", "direction()"), UnlockedAt: "2026-09-29T09:20:00Z", UnlockedByName: "Марія"},
        {ID: "h3", Level: "steps", Cost: 50, Unlocked: true, Content: hintDoc("Кроки", "steps()"), UnlockedAt: null, UnlockedByName: ""},
        {ID: "h4", Level: "near_solution", Cost: 100, Unlocked: true, Content: "Старий текстовий\nрядок " + LONG_WORD, UnlockedAt: null, UnlockedByName: ""},
    ],
    HintCostTotal: 75,
    BoardPublished: true,
};

export const fixtureTiles: OwnChallenge[] = Array.from({length: 24}, (_, index) => ({
    ...fixtureChallenge,
    ID: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`,
    EventChallengeID: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index).padStart(12, "0")}`,
    Snapshot: {...fixtureChallenge.Snapshot, name: index % 3 === 0 ? LONG_TITLE : index % 3 === 1 ? LONG_WORD : `Завдання ${index + 1}`},
    SolvedAt: index % 2 ? "2026-09-29T09:30:00Z" : null,
    ContentUpdatedAt: index % 4 === 0 ? "2026-09-29T09:00:00Z" : null,
    Locked: index % 5 === 4,
    Prerequisites: index % 5 === 4 ? [{EventChallengeID: fixtureChallenge.EventChallengeID, Name: "Попереднє завдання", Solved: false}] : [],
}));
