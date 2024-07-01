export interface Challenge {
    // from challenge template
    ID: string;
    Name: string;
    Points: number;
    Description: string;

    // from solved challenge table
    Solved: boolean;
}

export interface Category {
    ID: string;
    Name: string;
    Challenges: Challenge[];
}

export interface Solve {
    ID: string;
    TeamID: string;
    Name: string;
    SolvedAt: Date;
}