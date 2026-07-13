import {IResponse} from "@/types/api";
import {
    EventInfoSchema,
    EventTypeEnum,
    IEventInfo,
    ParticipantsVisibilityTypeEnum,
    ParticipationTypeEnum,
    RegistrationTypeEnum,
    ScoreboardVisibilityTypeEnum,
} from "@/types/event";

// The `.parse()` call below is the dev assert: a malformed fixture throws loudly at import time.
const data: IEventInfo = EventInfoSchema.parse({
    Tag: "winter-arena-2026",
    Name: "Winter Arena CTF",
    Description: "Річні командні змагання з практичних задач з інформаційної безпеки.",
    Rules: "Одна команда — один прапор. Обмін рішеннями та автоматизований перебір заборонені.",
    Picture: "",
    Type: EventTypeEnum.Competition,
    Participation: ParticipationTypeEnum.Team,
    StartTime: new Date(Date.now() - 3600_000).toISOString(),
    FinishTime: new Date(Date.now() + 6 * 3600_000).toISOString(),
    Registration: RegistrationTypeEnum.Open,
    ScoreboardAvailability: ScoreboardVisibilityTypeEnum.Public,
    ParticipantsVisibility: ParticipantsVisibilityTypeEnum.Public,
});

export const eventInfoFixture: IResponse<IEventInfo> = {
    Status: {Code: 200, Message: "OK"},
    Data: data,
};
