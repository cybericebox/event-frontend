import type {FormBlock, FormDocument, FormField} from "@/api/manageParticipantForm";

export function isFormField(block: FormBlock): block is FormField { return block.type === "field"; }

export function createFormField(input: FormField["input"] = "text"): FormField {
    return {id: `field-${crypto.randomUUID()}`, type: "field", key: `field_${crypto.randomUUID().replaceAll("-", "")}`, input, label: "", required: false, options: input === "select" || input === "multi_select" ? [""] : undefined};
}

export function validateParticipantForm(document: FormDocument): string | null {
    const ids = new Set<string>();
    const keys = new Set<string>();
    const previous = new Map<string, FormField>();
    for (const [index, block] of document.blocks.entries()) {
        if (!block.id || ids.has(block.id)) return `Блок ${index + 1}: повторний ідентифікатор.`;
        ids.add(block.id);
        if (!isFormField(block)) {
            if (block.type === "section" && !block.label?.trim()) return `Блок ${index + 1}: додайте заголовок.`;
            if (block.type === "text" && !block.markdown?.trim()) return `Блок ${index + 1}: додайте текст.`;
            if (block.type === "text" && block.markdown?.includes("<")) return `Блок ${index + 1}: HTML у тексті не підтримується.`;
            continue;
        }
        if (!block.key.trim() || keys.has(block.key)) return `Питання ${index + 1}: некоректний або повторний ключ.`;
        if (!block.label.trim()) return `Питання ${index + 1}: додайте текст питання.`;
        if ((block.input === "select" || block.input === "multi_select") && (!block.options?.length || block.options.some(option => !option.trim()) || new Set(block.options.map(option => option.trim())).size !== block.options.length)) return `Питання ${index + 1}: заповніть унікальні варіанти відповіді.`;
        if (block.condition) {
            const source = previous.get(block.condition.fieldKey);
            if (!source) return `Питання ${index + 1}: умова має посилатися на попереднє питання.`;
            if (source.input === "multi_select") return `Питання ${index + 1}: для умови оберіть питання з однією відповіддю.`;
            if (source.input === "number" && typeof block.condition.value !== "number") return `Питання ${index + 1}: вкажіть число в умові.`;
            if (source.input === "checkbox" && typeof block.condition.value !== "boolean") return `Питання ${index + 1}: вкажіть значення умови.`;
            if (source.input === "select" && !source.options?.includes(String(block.condition.value))) return `Питання ${index + 1}: оберіть варіант із попереднього питання.`;
        }
        keys.add(block.key);
        previous.set(block.key, block);
    }
    return null;
}
