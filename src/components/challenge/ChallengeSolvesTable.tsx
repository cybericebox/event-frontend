"use client"
import React from "react";
import {Center, Icon, Table, TableContainer, Tbody, Td, Th, Thead, Tr} from "@chakra-ui/react";
import moment from "moment";
import {GiDrop, GiMedal} from "react-icons/gi";
import {useChallenge} from "@/hooks/useChallenge";
import "@/app/globals.css"
import {useEvent} from "@/hooks/useEvent";
import {ParticipationTypeEnum} from "@/types/event";


function ChallengeSolvesTable({descriptionID}: { descriptionID: string }) {
    const {ChallengeSolvedByResponse} = useChallenge().useChallengeSolvedBy(descriptionID)
    const {GetEventInfoResponse} = useEvent().useGetEventInfo()

    return (
        <>
            {ChallengeSolvedByResponse && ChallengeSolvedByResponse.Data.length === 0 ? (
                <>
                    <Center w="100%">Немає жодного рішення</Center>
                </>
            ) : (
                <TableContainer
                    maxH="600px"
                    overflowY="auto"
                    w="100%"
                    marginBottom="25px"
                    padding="0px 20px 0px 20px"
                    minH="400px"
                >
                    <Table maxH="600px" maxW="100%" overflowX={"hidden"} variant="simple">
                        <Thead
                            w="100%"
                            position="sticky"
                            top={0}
                            zIndex="docked"
                            backgroundColor="#211a52"
                        >
                            <Tr>
                                <Th textAlign="center" color="#dfdfe3">#</Th>
                                <Th textAlign="center"
                                    color="#dfdfe3">{GetEventInfoResponse?.Data.Participation === ParticipationTypeEnum.Individual ? "Учасник" : "Команда"}</Th>
                                <Th textAlign="center" color="#dfdfe3">Час</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {ChallengeSolvedByResponse && ChallengeSolvedByResponse.Data.map((solve, index) => (
                                <Tr key={solve.ID}>
                                    {index > 2 ? (
                                        <Td textAlign="center">
                                            {index + 1}
                                        </Td>
                                    ) : (
                                        <>
                                            {index === 0 && (
                                                <Td>
                                                    <Icon fontSize="xl" color="#00e5ff" as={GiDrop}></Icon>
                                                </Td>
                                            )}
                                            {index === 1 && (
                                                <Td>
                                                    <Icon fontSize="xl" color="silver" as={GiMedal}></Icon>
                                                </Td>
                                            )}
                                            {index === 2 && (
                                                <Td>
                                                    <Icon fontSize="xl" color="#CD7F32" as={GiMedal}></Icon>
                                                </Td>
                                            )}
                                        </>
                                    )}

                                    <Td textAlign="center">{solve.Name}</Td>
                                    <Td textAlign="center">{
                                        moment(solve.SolvedAt).format("DD.MM.YYYY HH:mm:ss")

                                    }</Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                </TableContainer>
            )}
        </>
    );
}

export default ChallengeSolvesTable;
