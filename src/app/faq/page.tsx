'use client'

import {FaBookOpen} from "react-icons/fa"
import type React from 'react'
import {useEvent} from "@/hooks/useEvent";

export default function FaqPage() {
    const {GetEventInfoResponse} = useEvent().useGetEventInfo();
    return (
            <div
                className={"flex flex-col max-w-screen-2xl w-full mx-auto text-primary"}
            >
                <div
                    className={"w-full my-12"}
                >
                    <div
                        className={"flex items-center justify-center w-full text-5xl"}
                    >
                        <FaBookOpen/>
                        <div
                            className={"ml-5"}
                        >
                            Правила
                        </div>
                    </div>
                </div>
                <div
                    className={"text-lg md:text-xl font-medium mx-auto px-10"}
                >
                    {GetEventInfoResponse?.Data.Rules && (
                        <div
                            className={"ProseMirror"}
                            dangerouslySetInnerHTML={{
                                __html: GetEventInfoResponse?.Data.Rules,
                            }}
                        />
                    )}
                </div>
            </div>
    )
}
