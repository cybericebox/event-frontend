import type React from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import {useState} from "react";
import {
    Alert,
    AlertDescription,
    AlertIcon,
    Box,
    Button,
    chakra,
    Flex,
    FormControl,
    Input,
    InputGroup,
    InputLeftElement,
    InputRightElement,
    Link,
    Stack,
    Text
} from '@chakra-ui/react'
import {FaLock, FaUnlock} from "react-icons/fa";
import {RiTeamLine} from "react-icons/ri";
import {useTeam} from "@/hooks/useTeam";

const CFaLock = chakra(FaLock);
const CFaUnlock = chakra(FaUnlock);

export type Props = {
    setIsJoinTeam: Dispatch<SetStateAction<boolean>>;
}


export default function JoinTeam({setIsJoinTeam}: Props) {
    const [showPassword, setShowPassword] = useState(false);

    const {JoinTeam, JoinTeamResponse} = useTeam().useJoinTeam()

    const handleShowClick = () => setShowPassword(!showPassword);


    const [reqData, setData] = useState({
        name: "",
        code: "",
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        JoinTeam({
            Name: reqData.name,
            JoinCode: reqData.code
        })
    };

    const changeHandler = (e: any) => {
        if (e.target.name === "name") {
            setData({...reqData, [e.target.name]: e.target.value.trim()});
        } else {
            setData({...reqData, [e.target.name]: e.target.value});
        }
    };
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
                    Вступ до команди
                </Text>
                {
                    JoinTeamResponse?.data && (
                        JoinTeamResponse?.data.Status.Code === 0 ? (
                            <Alert status="error">
                                <AlertIcon/>
                                <AlertDescription>Неправильна назва команди чи код</AlertDescription>
                            </Alert>
                        ) : (
                            <Alert status="error">
                                <AlertIcon/>
                                <AlertDescription>Помилка на стороні сервера</AlertDescription>
                            </Alert>
                        )
                    )
                }

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
                            <FormControl>
                                <InputGroup>
                                    <InputLeftElement
                                        pointerEvents="none"
                                        color="gray.300"
                                    ><CFaLock color="gray.300"/></InputLeftElement>
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Код"
                                        name="code"
                                        required={true}
                                        onChange={changeHandler}
                                        tabIndex={2}
                                    />
                                    <InputRightElement width="4.5rem">
                                        <Button h="1.75rem" size="sm" onClick={handleShowClick}>
                                            {showPassword ? <CFaUnlock color="red.300"/> : <CFaLock color="green.300"/>}
                                        </Button>
                                    </InputRightElement>
                                </InputGroup>
                            </FormControl>
                            <Button
                                borderRadius={0}
                                type="submit"
                                variant="solid"
                                backgroundColor="#211a52"
                                color="white"
                                width="full"
                                mt={2}
                                tabIndex={3}
                            >
                                Доєднатись
                            </Button>
                        </Stack>
                    </form>
                </Box>
                <Text>
                    <Link onClick={() => setIsJoinTeam(false)} color="#54616e" tabIndex={4}>Моя команда ще не
                        зареєстрована</Link>
                </Text>
            </Stack>
        </Flex>
    );
}
