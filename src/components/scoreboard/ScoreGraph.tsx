import type React from 'react'
import ReactECharts from 'echarts-for-react';
import {useEvent} from "@/hooks/useEvent";

interface ScoreGraphProps {
    activeChartSeries: {
        labels: string[],
        data: any[]
    };
}

export default function ScoreGraph({activeChartSeries}: ScoreGraphProps) {
    const {GetEventInfoResponse} = useEvent().useGetEventInfo()
    const options = {
        legend: {
            // Try 'horizontal'
            orient: 'horizontal',
            selectedMode: false,
        },
        xAxis: {
            type: 'time',
            boundaryGap: false,
            max: () => {
                return GetEventInfoResponse?.Data.FinishTime.toISOString();
            },
            min : () => {
                return GetEventInfoResponse?.Data.StartTime.toISOString();
            }
        },
        yAxis: {
            type: 'value',
        },
        toolbox: {
            feature: {
                dataZoom: {
                    yAxisIndex: 'none',
                },
                saveAsImage: {
                }
            }
        },
        dataZoom: [
            {
                type: 'inside',
                filterMode: 'none',
                start: 0,
                end: 100
            },
            {
                start: 0,
                end: 10,
                handleSize: '80%'
            }
        ],
        series: activeChartSeries.data,
        tooltip: {
            trigger: 'axis',
        },
    }
    return <ReactECharts style={{height: "100%"}} option={options} notMerge={true}/>

}