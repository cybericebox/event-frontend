import {z} from "zod";

export const ContentValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const ContentVariableSchema = z.object({name: z.string(), format: z.enum(["text", "number", "date-time", "boolean"])});
export const ContentDateDisplaySchema = z.object({format: z.enum(["date-time", "date", "time", "short", "custom"]), pattern: z.string().optional()});
export const ContentVisibilitySchema = z.object({variable: z.string(), operator: z.string(), value: ContentValueSchema});
export const PageBlockTypes = ["section", "text", "hero", "banner", "facts", "timeline", "doc", "faq", "cta", "countdown", "divider"] as const;
export type PageBlockType = typeof PageBlockTypes[number];
export const ContentBlockSchema = z.object({
    id: z.string(),
    type: z.enum(PageBlockTypes),
    label: z.string().optional(),
    markdown: z.string().optional(),
    title: z.string().optional(),
    sub: z.string().optional(),
    text: z.string().optional(),
    by: z.string().optional(),
    kicker: z.string().optional(),
    note: z.string().optional(),
    tocTitle: z.string().optional(),
    items: z.array(z.object({
        label: z.string().optional(), value: z.string().optional(),
        dateSource: z.enum(["event", "custom"]).optional(),
        dateVariable: z.string().optional(), dateValue: z.string().optional(),
        dateFormat: z.enum(["date-time", "date", "time", "short", "custom"]).optional(),
        datePattern: z.string().optional(),
    })).optional(),
    targetVariable: z.string().optional(),
    targetDate: z.string().optional(),
    dateSource: z.string().optional(),
    layout: z.string().optional(),
    verticalAlignment: z.string().optional(),
    actionAlignment: z.string().optional(),
    timerSize: z.string().optional(),
    timerDisplay: z.enum(["segments", "compact", "tiles"]).optional(),
    surface: z.string().optional(),
    imageSource: z.string().optional(),
    imageURL: z.string().optional(),
    action: z.object({label: z.string(), href: z.string()}).optional(),
    secondaryAction: z.object({label: z.string(), href: z.string()}).optional(),
    variant: z.string().optional(),
    widthPercent: z.number().int().min(50).max(100).multipleOf(5).optional(),
    size: z.string().optional(),
    line: z.boolean().optional(),
    openItem: z.number().int().optional(),
    variables: z.array(ContentVariableSchema).optional(),
    dateDisplays: z.record(z.string(), z.record(z.string(), ContentDateDisplaySchema)).optional(),
    visibility: z.array(ContentVisibilitySchema).optional(),
});
export const ContentDocumentSchema = z.object({blocks: z.array(ContentBlockSchema)});
export const EventContentSchema = z.object({Landing: ContentDocumentSchema, Variables: z.record(z.string(), ContentValueSchema)});
export const EventPageContentSchema = z.object({
    Page: z.object({Slug: z.string(), Title: z.string(), Document: ContentDocumentSchema}),
    Variables: z.record(z.string(), ContentValueSchema),
});
export type ContentDocument = z.infer<typeof ContentDocumentSchema>;
export type ContentBlock = ContentDocument["blocks"][number];
export type ContentValue = z.infer<typeof ContentValueSchema>;
export type EventContent = z.infer<typeof EventContentSchema>;
export type EventPageContent = z.infer<typeof EventPageContentSchema>;
