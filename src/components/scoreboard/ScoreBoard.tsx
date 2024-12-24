"use client";

import ScoreGraph from "@/components/scoreboard/ScoreGraph";
import ScoreTable from "@/components/scoreboard/SolveTable";
import {useEvent} from "@/hooks/useEvent";
import {useState} from "react";
import type {IActiveChartSeriesItem} from "@/types/event";
import Loader from "@/components/Loader";

interface ScoreBoardProps {
    show: boolean;
}

export default function ScoreBoard({show}: ScoreBoardProps) {
    const {GetScoreResponse, GetScoreRequest} = useEvent().useGetScore({enabled: show})
    const [activeChartSeries, setActiveChartSeries] = useState<{
        labels: string[],
        data: IActiveChartSeriesItem[]
    }>({labels: [], data: []})

    if (!show) {
        return <div
            className={"text-lg md:text-2xl font-bold text-[#211a52] text-center"}
        >
            Результати будуть доступні після початку змагання
        </div>
    }

    if (GetScoreRequest.isLoading) {
        return <Loader/>
    }

    return (
        <>
            {
                GetScoreResponse && (
                    <>
                        <div
                            className={"h-[500px]"}
                        >
                            <ScoreGraph activeChartSeries={activeChartSeries}/>
                        </div>
                        <div
                            className={"mb-100"}
                        >
                            <center>
                                <ScoreTable activeChartSeries={activeChartSeries}
                                            setActiveChartSeries={setActiveChartSeries}/>
                            </center>
                        </div>
                    </>
                )
            }

        </>
    )

}