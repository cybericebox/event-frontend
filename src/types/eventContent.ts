import {z} from "zod";

export const ContentValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const ContentVariableSchema = z.object({name: z.string(), format: z.enum(["text", "number", "date-time", "boolean"])});
export const ContentVisibilitySchema = z.object({variable: z.string(), operator: z.string(), value: ContentValueSchema});
export const ContentBlockSchema = z.object({
    id: z.string(),
    type: z.enum(["section", "text"]),
    label: z.string().optional(),
    markdown: z.string().optional(),
    variables: z.array(ContentVariableSchema).optional(),
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
