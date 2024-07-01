import type React from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import {useState} from "react";
import {
    Alert,
    AlertDescription,
    AlertIcon,
    Box,
    Button,
    Flex,
    FormControl,
    Input,
    InputGroup,
    InputLeftElement,
    Link,
    Stack,
    Text
} from "@chakra-ui/react";
import {RiTeamLine} from "react-icons/ri";
import {useTeam} from "@/hooks/useTeam";

export type Props = {
    setIsJoinTeam: Dispatch<SetStateAction<boolean>>;
}

export default function CreateTeam({setIsJoinTeam}: Props) {
    const createTeam = useTeam().useCreateTeam()
    const [name, setName] = useState("");

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        createTeam.mutate({Name: name});
    };

    const changeHandler = (e: any) => {
        setName(e.target.value.trim());
    };

    console.log(createTeam);

    return (
        <Flex
            flexDirection="column"
            width="100%"
            height="85vh"
            alignItems="center"
            marginTop={"20px"}
        >
            <Stack
                flexDir="column"
                mb="2"
                justifyContent="center"
                alignItems="center"
            >
                <Text
                    marginBottom="10px"
                    fontSize="30px"
                    fontWeight="bold"
                    color="#211a52"
                >
                    Реєстрація команди
                </Text>
                {createTeam?.data?.message && (
                    createTeam?.data?.message === "team exists" ?
                        (<Alert status="error">
                            <AlertIcon/>
                            <AlertDescription>
                                Команда з такою назвою вже існує
                            </AlertDescription>
                        </Alert>) :
                        (
                            <Alert status="error">
                                <AlertIcon/>
                                <AlertDescription>Помилка на стороні сервера</AlertDescription>
                            </Alert>
                        ))}

                <Box minW={{base: "90%", md: "468px"}}>
                    <form onSubmit={handleSubmit}>
                        <Stack
                            spacing={4}
                            p="1rem"
                            backgroundColor="whiteAlpha.900"
                            boxShadow="md"
                        >
                            <FormControl>
                                <InputGroup>
                                    <InputLeftElement
                                        pointerEvents="none"
                                        color="gray.300"
                                    ><RiTeamLine color="gray.300"/></InputLeftElement>
                                    <Input
                                        type="text"
                                        name="name"
                                        required={true}
                                        placeholder="Назва команди"
                                        onChange={changeHandler}
                                        tabIndex={1}
                                    />
                                </InputGroup>
                            </FormControl>

                            <Button
                                borderRadius={0}
                                type="submit"
                                variant="solid"
                                backgroundColor="#211a52"
                                color="white"
                                width="full"
                                tabIndex={2}
                            >
                                Створити команду
                            </Button>
                        </Stack>
                    </form>
                </Box>
                <Text>
                    <Link onClick={() => setIsJoinTeam(true)} color="#54616e" tabIndex={3}>Я вже маю команду</Link>
                </Text>
            </Stack>
        </Flex>
    )
}
