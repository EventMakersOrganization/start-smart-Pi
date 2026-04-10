export interface Webinar {
    _id?: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    instructorName: string;
    scheduledStartTime: Date;
    durationMinutes: number;
    status: 'scheduled' | 'live' | 'ended';
    participants?: { userId: string; username: string }[];
}

export interface ChatMessage {
    userId: string;
    username: string;
    message: string;
    timestamp: Date;
}
