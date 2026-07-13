import {z} from "zod";

export const NotificationSchema = z.object({
    ID: z.string(),
    Title: z.string(),
    Body: z.string(),
    CreatedAt: z.coerce.date(),
    Read: z.boolean().default(false),
})

export interface INotification extends z.infer<typeof NotificationSchema> {
}
