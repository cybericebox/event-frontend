"use client"
import {Box, Card, CardBody, Center, Flex, Heading, HStack, Icon, Stack, StackDivider, Text} from "@chakra-ui/react";
import {RiTeamLine} from "react-icons/ri";
import CopyToClipboardButtonWithToast from "@/components/CopyToClipboardButtonWIthToast";
import type React from "react";
import {useTeam} from "@/hooks/useTeam";
import Loader from "@/components/Loaders";

export default function TeamProfile() {
    const team = useTeam().useGetTeam(true)
    if (team.isLoading) {
        return <Loader/>
    }
    return (
        <Flex maxW={"800px"} w="100%" m={"auto"} flexDir="column" color="#211a52">
            <Box w="100%" marginTop="50px" marginBottom="50px">
                <Center w="100%" fontSize="50px" mb={"20px"}>
                    <Icon as={RiTeamLine}/>
                    <Text marginLeft="20px">Команда</Text>
                </Center>
                <Card mt={"20px"}>
                    <CardBody>
                        {!team.data?.Name ? <Center><Heading size='xs' textTransform='uppercase'>
                                Ви не долучились до жодної з команд
                            </Heading> </Center> :
                            <Stack divider={<StackDivider/>} spacing='4'>
                                <Box>
                                    <Heading size='xs' textTransform='uppercase'>
                                        Назва команди
                                    </Heading>
                                    <Text pt='2' fontSize='sm'>
                                        {team.data?.Name}
                                    </Text>
                                </Box>
                                <Box>
                                    <Heading size='xs' textTransform='uppercase'>
                                        Код для приєднання
                                    </Heading>
                                    <HStack pt='2'>
                                        <Text fontSize='sm'>
                                            ****************
                                        </Text>
                                        <CopyToClipboardButtonWithToast
                                            textToCopy={team.data?.JoinCode}
                                            toastOptions={{
                                                title: 'Скопійовано',
                                                description: "Код для приєднання було успішно скопійовано до буферу обміну.",
                                                status: 'success',
                                                duration: 9000,
                                                isClosable: true,
                                            }}
                                            ml={"90px"}
                                            fontSize='sm'
                                        >
                                            Скопіювати код
                                        </CopyToClipboardButtonWithToast>
                                    </HStack>
                                </Box>
                            </Stack>}
                    </CardBody>
                </Card>
            </Box>
        </Flex>
    )
}