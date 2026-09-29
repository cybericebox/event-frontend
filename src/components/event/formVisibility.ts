import type {FormBlock, FormField} from "@/api/manageParticipantForm";
import type {ParticipantAnswer as Answer} from "@/api/participantForm";

function isField(block: FormBlock): block is FormField { return block.type === "field"; }

// The answer a condition compares against. An untouched checkbox means «Ні»,
// every other unanswered question has no value and never satisfies a condition.
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
        const value = comparable(source, answers[source.key]);
        if (value === undefined) continue;
        const equals = value === String(condition.value);
        if (condition.operator === "equals" ? equals : condition.operator === "not_equals" && !equals) shown.add(block.key);
    }
    return shown;
}
