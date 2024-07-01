import type React from 'react'
import ReactECharts from 'echarts-for-react';

interface ScoreGraphProps {
    activeChartSeries: {
        labels: string[],
        data: any[]
    };
}

export default function ScoreGraph({activeChartSeries}: ScoreGraphProps) {

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
                let now = new Date().toISOString();
                return now
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
                saveAsImage: {}
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