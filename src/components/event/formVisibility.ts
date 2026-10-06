import type {FormBlock, FormField} from "@/api/manageParticipantForm";
import type {ParticipantAnswer as Answer} from "@/api/participantForm";
import {dateModeOf, parseDateAnswer} from "@/components/event/manage/participantFormEditor";

function isField(block: FormBlock): block is FormField { return block.type === "field"; }

// The answer a condition compares against. An untouched checkbox means «Ні»,
// every other unanswered question has no value and never satisfies a condition.
// A date answer compared in time: equals, not_equals, before or after.
function dateMatches(source: FormField, operator: string, answer: Answer | undefined, expected: unknown): boolean {
    const at = parseDateAnswer(dateModeOf(source), answer);
    const want = parseDateAnswer(dateModeOf(source), expected);
    if (at === null || want === null) return false;
    return operator === "equals" ? at === want : operator === "not_equals" ? at !== want : operator === "before" ? at < want : operator === "after" && at > want;
}

function comparable(source: FormField, answer: Answer | undefined): string | undefined {
    if (source.input === "checkbox") return String(answer === true);
    if (answer === undefined || answer === "" || typeof answer === "object") return undefined;
    return String(answer);
}

// Keys of the questions a participant sees for the given answers. A question
// with a condition is shown only when its source question is shown and the
// source answer matches, so hiding a question also hides everything that
// depends on it. Mirrors eventFormModel.Form.ValidateAnswers on the backend.
export function visibleFieldKeys(blocks: FormBlock[], answers: Record<string, Answer>): Set<string> {
    const fields = new Map<string, FormField>();
    const shown = new Set<string>();
    for (const block of blocks) {
        if (!isField(block)) continue;
        fields.set(block.key, block);
        const condition = block.condition;
        if (!condition) {shown.add(block.key); continue;}
        const source = fields.get(condition.fieldKey);
        if (!source || source === block || !shown.has(source.key)) continue;
        if (source.input === "date") {
            if (dateMatches(source, condition.operator, answers[source.key], condition.value)) shown.add(block.key);
            continue;
        }
        const value = comparable(source, answers[source.key]);
        if (value === undefined) continue;
        const equals = value === String(condition.value);
        if (condition.operator === "equals" ? equals : condition.operator === "not_equals" && !equals) shown.add(block.key);
    }
    return shown;
}
