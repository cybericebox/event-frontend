import {z} from "zod";

// Flag attempt limits are whole numbers from 1 to 1000; null = no value (unlimited on an event, the event's value on a task).
export const MAX_FLAG_ATTEMPTS = 1000;
export const attemptLimit = z.number().int().min(1).max(MAX_FLAG_ATTEMPTS).nullish().transform(value => value ?? null);
