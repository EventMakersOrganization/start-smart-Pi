export interface CodeProblem {
    id: string;
    title: string;
    description: string;
    difficulty: "easy" | "medium" | "hard";
    languageTemplates: {
        javascript: string;
        python: string;
        java: string;
        cpp: string;
    };
    testCases: {
        input: any;
        expectedOutput: any;
    }[];
}

export interface Player {
    socketId: string;
    username: string;
    score: number;
    progress: number;
    status: "waiting" | "typing" | "running" | "finished" | "idle" | "submitted";
    solvedCount: number;
}

export interface PendingSubmission {
    socketId: string;
    code: string;
    timeLeft: number;
    success?: boolean;
    passedTests?: number;
    totalTests?: number;
}

export interface Room {
    roomCode: string;
    hostId: string;
    players: Player[];
    difficulty: string;
    language: string;
    totalProblems: number;
    problems: CodeProblem[];
    currentProblemIndex: number;
    status: "waiting" | "playing" | "finished";
    timer: number;
    startTime?: number;
    pendingSubmissions: Map<string, PendingSubmission>;
    timerInterval?: any;
}

export interface SoloSession {
    sessionId: string;
    userId: string;
    problems: CodeProblem[];
    currentProblemIndex: number;
    score: number;
    solved: number;
    totalProblems: number;
    startTime: number;
    accuracy: number;
}

