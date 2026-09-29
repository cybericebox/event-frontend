import type {ContentValue} from "@/types/eventContent";
import {z} from "zod";
import {t} from "@/i18n/t";

export type ContentVariableFormat = "text" | "number" | "date-time" | "boolean";
export const ContentVariableDefinitionSchema = z.object({
    name: z.string(), label: z.string(),
    format: z.enum(["text", "number", "date-time", "boolean"]),
    audience: z.union([z.literal(0), z.literal(1), z.literal(2)]),
});
export type ContentVariableDefinition = z.infer<typeof ContentVariableDefinitionSchema>;
export const ContentVariableCatalogSchema = z.array(ContentVariableDefinitionSchema);

const readableTextVariables = new Set(["event.name", "event.tag", "event.previewDescription"]);

export function insertableContentVariable(variable: ContentVariableDefinition) {
    return variable.format === "number" || variable.format === "date-time" || readableTextVariables.has(variable.name);
}

export function visibilityOperators(format: ContentVariableFormat) {
    if (format === "boolean" || format === "text") return [{value: "equals", label: t("content.variables.operator.equals")}, {value: "not_equals", label: t("content.variables.operator.notEquals")}];
    if (format === "date-time") return [{value: "before", label: t("content.variables.operator.before")}, {value: "after", label: t("content.variables.operator.after")}, {value: "equals", label: t("content.variables.operator.equals")}, {value: "not_equals", label: t("content.variables.operator.notEquals")}];
    return [{value: "equals", label: t("content.variables.operator.equals")}, {value: "not_equals", label: t("content.variables.operator.notEquals")}, {value: "greater_than", label: t("content.variables.operator.greaterThan")}, {value: "greater_or_equal", label: t("content.variables.operator.greaterOrEqual")}, {value: "less_than", label: t("content.variables.operator.lessThan")}, {value: "less_or_equal", label: t("content.variables.operator.lessOrEqual")}];
}

export function initialVisibilityValue(format: ContentVariableFormat): ContentValue {
    if (format === "boolean") return true;
    if (format === "number") return 0;
    if (format === "date-time") return new Date().toISOString();
    return "";
}
