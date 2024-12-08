import {NextResponse} from 'next/server'

// health route
export async function GET() {
    return new NextResponse("health") // return empty response
}