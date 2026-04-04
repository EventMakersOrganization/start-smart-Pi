export declare class CreateStudentProfileDto {
    userId: string;
    level?: string;
    learningPreferences?: {
        preferredStyle?: string;
        preferredDifficulty?: string;
        studyHoursPerDay?: number;
    };
    progress?: number;
    strengths?: string[];
    weaknesses?: string[];
}
