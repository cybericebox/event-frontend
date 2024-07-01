"use client";
import React, {ChangeEvent, useCallback, useEffect, useState} from "react";
import {
    Box,
    Button,
    Center,
    HStack,
    Icon,
    Input,
    InputGroup,
    InputRightElement,
    Switch,
    Table,
    TableContainer,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
} from "@chakra-ui/react";
import {FaFlag} from "react-icons/fa";
import {GiDrop, GiMedal, GiTrophy} from "react-icons/gi";
import cloneDeep from "lodash/cloneDeep";
import {debounce} from "lodash";
import {useEvent} from "@/hooks/useEvent";
import {ActiveChartSeriesItem, ParticipationType, TeamScore} from "@/types/event";


interface ScoreTableProps {
    activeChartSeries: { labels: string[], data: ActiveChartSeriesItem[] };
    setActiveChartSeries: ({labels, data}: { labels: string[], data: ActiveChartSeriesItem[] }) => void;
}

export default function ScoreTable(props: ScoreTableProps) {
    const score = useEvent().useGetScore()
    const getEventInfo = useEvent().useGetEventInfo()
    const [tableData, setTableData] = useState<TeamScore[]>([])
    const [searchValue, setSearchValue] = useState("");
    //
    const columnWidth = 63;
    const maxWidth = 500;
    const calculateMinWidth = () => {
        let width = score?.data?.ChallengeList ? score?.data?.ChallengeList?.length * columnWidth : 0;
        if (width < maxWidth) {
            return String(width) + "px";
        } else {
            return String(maxWidth) + "px";
        }
    };
    //
    const calculateOverflow = () => {
        let width = score?.data?.ChallengeList ? score?.data?.ChallengeList?.length * columnWidth : 0;
        if (width < maxWidth) {
            return "visible";
        } else {
            return "scroll";
        }
    };
    //
    const getInChartLabels = (activeChartSeries: ActiveChartSeriesItem[]) => {
        let data: string[] = [];
        activeChartSeries.forEach((element) => {
            data.push(element.name)
        })
        return data
    }
    //
    const changeSearchData = (text: string, activeChartSeriesData: {
        labels: string[],
        data: ActiveChartSeriesItem[]
    }) => {

        let newTableData: TeamScore[] = [];
        if (!score?.data?.TeamsScores) {
            return;
        }
        if (text === "") {
            newTableData = cloneDeep(score?.data?.TeamsScores)
        } else {
            newTableData =
                cloneDeep(
                    score?.data?.TeamsScores.filter((el) => {
                        return el.TeamName.toLowerCase().indexOf(text.toLowerCase()) > -1;
                    })
                )
        }

        newTableData.forEach((element) => {
            element.InChart = activeChartSeriesData.labels.includes(element.TeamName)
        })
        setTableData(newTableData)
    };

    const chartSwitchHandler = (e: ChangeEvent<HTMLInputElement>, team: TeamScore) => {
        let newSeriesArray: ActiveChartSeriesItem[] = [];

        if (!score?.data?.TeamsScores) return;

        if (e.target.checked) {
            newSeriesArray = cloneDeep(props.activeChartSeries.data);
            let seriesToPush = {
                name: score?.data?.TeamsScores[team.Rank - 1].TeamName,
                data: score?.data?.TeamsScores[team.Rank - 1].TeamScoreTimeline,
                type: "line",
            };
            newSeriesArray.push(seriesToPush);
        } else {
            props.activeChartSeries.data.forEach((element) => {
                if (element.name !== team.TeamName) {
                    newSeriesArray.push(element);
                }
            });
        }

        tableData.forEach((element) => {
            if (team.TeamName === element.TeamName) {
                element.InChart = e.target.checked
            }
        })

        props.setActiveChartSeries({labels: getInChartLabels(newSeriesArray), data: newSeriesArray});

    };

    const setAllInChart = (inChart: boolean) => {
        tableData.forEach((element) => {
            element.InChart = inChart;
        })
    }
    //
    const clearChart = () => {
        setAllInChart(false)
        props.setActiveChartSeries({labels: [], data: []})
    }

    const debounceLoadData = useCallback(debounce(changeSearchData, 500), []);

    useEffect(() => {
        debounceLoadData(searchValue, props.activeChartSeries);
    }, [searchValue, props.activeChartSeries, debounceLoadData]);

    useEffect(() => {
        if (score?.data?.ActiveChartSeries) {
            props.setActiveChartSeries({
                labels: getInChartLabels(score?.data?.ActiveChartSeries),
                data: score?.data?.ActiveChartSeries
            })
        }
    }, [])


    return (
        <Box
            w="100%"
            className="solve-table-container"
            style={{caretColor: "black"}}
        >
            <HStack w="100%">
                <InputGroup size="md" w="300px" top="60px">
                    <Input
                        placeholder={getEventInfo.data?.Participation === ParticipationType.Individual ? "Знайти учасника" : "Знайти команду"}
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        borderColor="#211a52"
                    />
                    <InputRightElement width="4.5rem">
                        <Button
                            h="1.75rem"
                            size="sm"
                            onClick={(e) => setSearchValue("")}
                            backgroundColor="#54616e"
                            _hover={{backgroundColor: "#434d56"}}
                            color="#dfdfe3"
                            variant="solid"
                        >
                            Очистити
                        </Button>
                    </InputRightElement>
                </InputGroup>
                <Button
                    top="60px"
                    backgroundColor="#54616e"
                    _hover={{backgroundColor: "#434d56"}}
                    color="#dfdfe3"
                    variant="solid"
                    onClick={clearChart}
                >
                    Очистити графік
                </Button>
            </HStack>

            <HStack spacing="0" w="100%" className="solve-table-container">
                <TableContainer style={{overflowX: "auto"}} >
                    <Table
                        variant="unstyled"
                        className="rotated-header solve-table table-left"
                    >
                        <Thead>
                            <Tr>
                                <Th textAlign="center">#</Th>
                                <Th>На графіку</Th>
                                <Th>{getEventInfo.data?.Participation === ParticipationType.Individual ? "Учасник" : "Команда"}</Th>
                                <Th>Результат</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {tableData.map((team) => (
                                <Tr key={team.TeamName}>
                                    {Number(team.Rank) > 3 ? (
                                        <Td textAlign="center" width="20px">
                                            {team.Rank}
                                        </Td>
                                    ) : (
                                        <>
                                            {Number(team.Rank) === 1 && (
                                                <Td width="20px">
                                                    <Icon
                                                        fontSize="xl"
                                                        color="#FFD700"
                                                        as={GiTrophy}
                                                    ></Icon>
                                                </Td>
                                            )}
                                            {Number(team.Rank) === 2 && (
                                                <Td width="20px">
                                                    <Icon
                                                        fontSize="xl"
                                                        color="silver"
                                                        as={GiTrophy}
                                                    ></Icon>
                                                </Td>
                                            )}
                                            {Number(team.Rank) === 3 && (
                                                <Td width="20px">
                                                    <Icon
                                                        fontSize="xl"
                                                        color="#CD7F32"
                                                        as={GiTrophy}
                                                    ></Icon>
                                                </Td>
                                            )}
                                        </>
                                    )}
                                    <Td width="20px">
                                        <Switch
                                            value={Number(team.InChart)}
                                            isChecked={team.InChart}
                                            onChange={(e) => chartSwitchHandler(e, team)}
                                            id="email-alerts"
                                        />
                                    </Td>
                                    <Td minW={"300px"}>{team.TeamName}</Td>
                                    <Td width="60px">{team.Score}</Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                </TableContainer>
                <TableContainer
                    minW={calculateMinWidth()}
                    overflowX={calculateOverflow()}
                    overscrollX={"auto"}
                    paddingLeft="1px"
                    overflowY="visible"
                >
                    <Table
                        variant="unstyled"
                        width="fit-content"
                        className="rotated-header solve-table table-right"
                    >
                        <Thead>
                            <Tr>
                                {score?.data?.ChallengeList && Object.entries(score?.data?.ChallengeList).map(([key, challenge]) => (
                                    <Th key={key}>
                                        <div className="rotated-header-container">
                                            <div className="rotated-header-content">
                                                {challenge.Name}
                                            </div>
                                        </div>
                                    </Th>
                                ))}
                            </Tr>
                        </Thead>
                        <Tbody>
                            {tableData.map((team) => (
                                <Tr key={team.TeamName}>
                                    {score?.data?.ChallengeList && Object.entries(score?.data?.ChallengeList).map(([key, challenge]) => (
                                        <Td key={key} className="table-solve-icon-container">
                                            <Center>
                                                {team.TeamSolutions[challenge.ID!] && (
                                                    <>
                                                        {team.TeamSolutions[challenge.ID!].Rank === 1 && (
                                                            <Icon
                                                                fontSize="xl"
                                                                color="#00e5ff"
                                                                as={GiDrop}
                                                            ></Icon>
                                                        )}
                                                        {team.TeamSolutions[challenge.ID!].Rank === 2 && (
                                                            <Icon
                                                                fontSize="xl"
                                                                color="silver"
                                                                as={GiMedal}
                                                            ></Icon>
                                                        )}
                                                        {team.TeamSolutions[challenge.ID!].Rank === 3 && (
                                                            <Icon
                                                                fontSize="xl"
                                                                color="#CD7F32"
                                                                as={GiMedal}
                                                            ></Icon>
                                                        )}
                                                        {team.TeamSolutions[challenge.ID!].Rank > 3 && (
                                                            <Icon as={FaFlag}/>
                                                        )}
                                                    </>
                                                )}
                                            </Center>
                                        </Td>
                                    ))}
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                </TableContainer>
            </HStack>
        </Box>
    );
}

