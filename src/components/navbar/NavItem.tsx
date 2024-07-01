import type React from 'react';
import {Flex, Icon, Menu, MenuButton, Text} from '@chakra-ui/react';
import Link from "next/link"
import {Tooltip} from 'react-tooltip';

export interface NavItemProps {
    icon: React.ElementType;
    title: string;
    navSize: string;
    to: string;
    customClickEvent?: () => void;
    displayTitle?: boolean;
    displayTooltip?: boolean;
    external?: boolean;
}

export default function NavItem({
                                    icon,
                                    title,
                                    navSize,
                                    to,
                                    customClickEvent,
                                    displayTitle,
                                    displayTooltip,
                                    external
                                }: NavItemProps) {

    return (
        <Flex
            flexDir="row"
            w="100%"
            alignItems="center"

            color={"#dfdfe3"}
        >
            <Menu placement="right">
                <Link
                    id={title}
                    className={"px-3 pt-3 pb-1.5 border-b-[3px] border-transparent w-full text-lg"}
                    href={to}
                    onClick={customClickEvent}
                    prefetch={!external}
                >
                    <MenuButton w="100%" lineHeight={1.35}>
                        <Flex>
                            <Icon as={icon} fontSize="2xl"/>
                            {navSize === 'large' &&
                                <Text ml={2} display={displayTitle ? "flex" : "none"}>{title}</Text>

                            }
                        </Flex>
                    </MenuButton>
                </Link>
                {(navSize === 'medium' || displayTooltip) &&
                    <Tooltip anchorSelect={`.${title}`} content={title} place="bottom"/>
                }

            </Menu>
        </Flex>
    )
}
