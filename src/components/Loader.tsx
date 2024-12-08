import {Loader as LoaderIcon} from 'lucide-react'
import {cn} from "@/utils/cn";

interface LoaderProps {
    className?: string
}

export default function Loader({className}: LoaderProps) {
    return (
        <div className='flex justify-center items-center'>
            <LoaderIcon className={cn('animate-spin h-16 w-16', className)}/>
        </div>
    )
}

