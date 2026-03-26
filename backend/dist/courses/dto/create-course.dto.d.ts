export declare class CreateModuleDto {
    title: string;
    description?: string;
    order?: number;
}
export declare class CreateCourseDto {
    title: string;
    description: string;
    level: string;
    instructorId?: string;
    modules?: CreateModuleDto[];
}
