import { AlertService } from './alert.service';
export declare class AlertController {
    private readonly alertService;
    constructor(alertService: AlertService);
    create(createAlertDto: any): Promise<import("./schemas/alert.schema").Alert>;
    findAll(): Promise<import("./schemas/alert.schema").Alert[]>;
    count(): Promise<number>;
    findUnresolved(): Promise<import("./schemas/alert.schema").Alert[]>;
    findOne(id: string): Promise<import("./schemas/alert.schema").Alert>;
    findByStudent(studentId: string): Promise<import("./schemas/alert.schema").Alert[]>;
    findByInstructor(instructorId: string): Promise<import("./schemas/alert.schema").Alert[]>;
    update(id: string, updateAlertDto: any): Promise<import("./schemas/alert.schema").Alert>;
    resolve(id: string): Promise<import("./schemas/alert.schema").Alert>;
    remove(id: string): Promise<void>;
}
