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
import type {IChallengeInfo} from "@/types/challenge";

export interface ChallengeFormProps {
    disabled: boolean;
    challenge: IChallengeInfo;
    onClose: () => void;
}

export default function ChallengeForm(props: ChallengeFormProps) {
    const {SolveChallenge, SolveChallengeResponse} = useChallenge().useSolveChallenge(props.challenge.ID)
    const [flag, setFlag] = useState("");

    const submitForm = async (e: any) => {
        e.preventDefault();

        SolveChallenge({
            Solution: flag,
        }, {
            onSuccess: () => {
                if (SolveChallengeResponse?.data.Data.Solved) {
                    setTimeout(() => props.onClose(), 2000)
                }
            }
        })

        setFlag("");
    };


    const changeHandler = (e: any) => {
        setFlag(e.target.value);
    };


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
                    <div className={"flex flex-wrap my-5 gap-3"}>
                        {props.challenge.AttachedFiles.map((file, index) => (
                                <div
                                    key={file.ID}
                                    className={"text-center bg-primary text-white px-3 py-2 rounded-md font-medium"}
                                >
                                    <a
                                        key={index}
                                        href={`/api/events/self/challenges/${props.challenge.ID}/download/${file.ID}`}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {file.Name}
                                    </a>
                                </div>
                            ))
                        }
                    </div>
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
                            <Collapse in={SolveChallengeResponse?.data.Data && !SolveChallengeResponse?.data.Data.Solved}>
                                <Alert status="error">
                                    <AlertIcon/>
                                    <AlertDescription>
                                        {"Відповідь не прийнято"}
                                    </AlertDescription>
                                </Alert>
                            </Collapse>
                            <Collapse in={SolveChallengeResponse?.data.Data && SolveChallengeResponse?.data.Data.Solved}>
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
