"use client"
import {
    Alert,
    AlertDescription,
    AlertIcon,
    Box,
    Button,
    Center,
    Collapse,
    Flex,
    FormControl,
    Input,
    InputGroup,
    InputLeftElement,
    ModalFooter,
    Stack,
    Text
} from "@chakra-ui/react";
import {MdFlag} from "react-icons/md";
import type React from "react";
import {useState} from "react";
import {useChallenge} from "@/hooks/useChallenge";
import type {Challenge} from "@/types/challenge";

export interface ChallengeFormProps {
    disabled: boolean;
    challenge: Challenge;
    onClose: () => void;
}

export default function ChallengeForm(props: ChallengeFormProps) {
    const solve = useChallenge().useSolveChallenge(props.challenge.ID)
    const [flag, setFlag] = useState("");

    const submitForm = async (e: any) => {
        e.preventDefault();

        solve.mutate({
            Solution: flag,
        })

        setFlag("");
    };


    const changeHandler = (e: any) => {
        setFlag(e.target.value);
    };

    solve.isSuccess && solve?.data?.message === "Challenge solved successfully" && setTimeout(() => props.onClose(), 2000)

    return (
        <>
            <Flex
                maxH="600px"
                overflowY="auto"
                marginRight="3px"
                padding="0px 20px 0px 20px"
            >
                <Stack w="100%">
                    <Flex
                        w="100%"
                        flexDir="column"
                        fontFamily="Audiowide"
                        fontSize="20px"
                    >
                        <Box w="100%" marginTop="20px">
                            <Center>
                                <Text textAlign="center">
                                    {props.challenge.Name}
                                </Text>
                            </Center>
                        </Box>
                        <Box w="100%" marginTop="10px" marginBottom="45px">
                            <Center>
                                <Text>{props.challenge.Points}</Text>
                            </Center>
                        </Box>
                    </Flex>
                    <Flex backgroundColor="#fff" color="#000">
                        <div
                            dangerouslySetInnerHTML={{
                                __html: props.challenge.Description,
                            }}
                        />
                    </Flex>
                </Stack>
            </Flex>
            <form onSubmit={submitForm}>
                <ModalFooter>
                    <Flex w="100%">
                        <Stack w="100%">
                            <FormControl marginBottom="20px">
                                <InputGroup>
                                    <InputLeftElement
                                        pointerEvents="none"
                                    >
                                        <MdFlag fontSize="25px" color="#7e8b9f"/>
                                    </InputLeftElement>
                                    <Input
                                        isDisabled={props.challenge.Solved || props.disabled}
                                        size="lg"
                                        borderBottomWidth="2px"
                                        variant="flushed"
                                        type="text"
                                        name="name"
                                        onChange={changeHandler}
                                        placeholder="ICE{прапор}"
                                    />
                                </InputGroup>
                            </FormControl>
                            <Collapse in={solve?.data?.message === "incorrect solution"}>
                                <Alert status="error">
                                    <AlertIcon/>
                                    <AlertDescription>
                                        {"Відповідь не прийнято"}
                                    </AlertDescription>
                                </Alert>
                            </Collapse>
                            <Collapse in={solve?.data?.message === "Challenge solved successfully"}>
                                <Alert status="success">
                                    <AlertIcon/>
                                    <AlertDescription>
                                        {"Блище до перемоги!"}
                                    </AlertDescription>
                                </Alert>
                            </Collapse>
                            <Button
                                w="100%"
                                type="submit"
                                bg={!props.challenge.Solved ? "#211a52" : "#5caf8d"}
                                _hover={!props.challenge.Solved ? {bg: "#18123a"} : {bg: "#4c9a79"}}
                                color="#dfdfe3"
                                variant="solid"
                                isDisabled={props.challenge.Solved || props.disabled}
                            >
                                {props.challenge.Solved ? (<>Вже вирішено</>) : !props.disabled ? (
                                    <>Відправити</>
                                ) : (
                                    <>Відповіді не приймаються</>
                                )}
                            </Button>
                        </Stack>
                    </Flex>
                </ModalFooter>
            </form>
        </>
    )
}
