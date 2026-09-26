import type {ContentValue} from "@/types/eventContent";
import {z} from "zod";

export type ContentVariableFormat = "text" | "number" | "date-time" | "boolean";
export const ContentVariableDefinitionSchema = z.object({
    name: z.string(), label: z.string(),
    format: z.enum(["text", "number", "date-time", "boolean"]),
    audience: z.union([z.literal(0), z.literal(1), z.literal(2)]),
});
export type ContentVariableDefinition = z.infer<typeof ContentVariableDefinitionSchema>;
export const ContentVariableCatalogSchema = z.array(ContentVariableDefinitionSchema);

export function visibilityOperators(format: ContentVariableFormat) {
    if (format === "boolean" || format === "text") return [{value: "equals", label: "Дорівнює"}, {value: "not_equals", label: "Не дорівнює"}];
    if (format === "date-time") return [{value: "before", label: "До"}, {value: "after", label: "Після"}, {value: "equals", label: "Дорівнює"}, {value: "not_equals", label: "Не дорівнює"}];
    return [{value: "equals", label: "Дорівнює"}, {value: "not_equals", label: "Не дорівнює"}, {value: "greater_than", label: "Більше"}, {value: "greater_or_equal", label: "Не менше"}, {value: "less_than", label: "Менше"}, {value: "less_or_equal", label: "Не більше"}];
}

export function initialVisibilityValue(format: ContentVariableFormat): ContentValue {
    if (format === "boolean") return true;
    if (format === "number") return 0;
    if (format === "date-time") return new Date().toISOString();
    return "";
}
