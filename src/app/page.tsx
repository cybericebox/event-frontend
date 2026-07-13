import Image from "next/image";
import type React from "react";
import {redirect} from "next/navigation";
import {WithEventForm} from "@/components/event/WithEvent";
import {CountdownTimer} from "@/components/Countdown";
import {getEventInfoOnServerFn} from "@/api/serverAPI";

export default async function LandingPage() {
    const eventInfo = await getEventInfoOnServerFn()

    // In-event (StartTime <= now < FinishTime) → the App shell is the home; send the
    // participant straight to challenges. The not-in-event branch keeps the landing render
    // (proper Landing is a later sub-project).
    const start = eventInfo?.Data?.StartTime;
    const finish = eventInfo?.Data?.FinishTime;
    if (start && finish) {
        const now = Date.now();
        if (new Date(start).getTime() <= now && now < new Date(finish).getTime()) {
            redirect("/challenges");
        }
    }

    return (
        <div
            className="md:p-1 flex flex-col gap-5 items-center justify-center"
        >
            {!!eventInfo?.Data &&
                (!!eventInfo?.Data.Picture ?
                        <Image
                            priority={true}
                            width={1920}
                            height={1080}
                            alt={`Banner ${eventInfo?.Data.Name}`}
                            src={eventInfo?.Data.Picture}
                            className="rounded-b-lg md:rounded-2xl shadow-2xl lg:max-w-[90vw] xl:max-w-[65vw] w-full"
                        />
                        : <center>
                            <div
                                className={"text-5xl font-bold mt-5 md:mt-10 max-w-screen-2xl"}
                            >
                                {eventInfo?.Data.Name}
                            </div>
                        </center>
                )
            }
            <WithEventForm>
                <CountdownTimer
                    text={"До початку заходу залишилось"}
                    until={eventInfo?.Data?.StartTime || 0}
                    className={"text-lg md:text-2xl font-bold text-[#211a52] rounded-lg border border-gray-200 shadow-lg p-3 md:px-4 md:py-5"}
                />
            </WithEventForm>
            {!!eventInfo?.Data && (
                <div
                    className={"px-10 max-w-screen-xl ProseMirror w-full"}
                    dangerouslySetInnerHTML={{__html: eventInfo.Data.Description}}
                />
                )}
        </div>

    );
}
