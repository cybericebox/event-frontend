import {z} from "zod";
import {IResponse} from "@/types/api";
import {INotification, NotificationSchema} from "@/types/notification";

// The `.parse()` call below is the dev assert: a malformed fixture throws loudly at import time.
const list: INotification[] = z.array(NotificationSchema).parse([
    {
        ID: "n1",
        Title: "Змагання розпочато",
        Body: "Успіхів! Прапори чекають — перевірте розділ завдань.",
        CreatedAt: new Date(Date.now() - 3000_000).toISOString(),
        Read: false,
    },
    {
        ID: "n2",
        Title: "Нове завдання відкрито",
        Body: "У категорії Web з'явилось нове завдання.",
        CreatedAt: new Date(Date.now() - 1200_000).toISOString(),
        Read: true,
    },
]);

export const notificationsFixture: IResponse<INotification[]> = {
    Status: {Code: 200, Message: "OK"},
    Data: list,
};
