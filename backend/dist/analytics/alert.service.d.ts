import { Model } from 'mongoose';
import { Alert, AlertDocument } from './schemas/alert.schema';
export declare class AlertService {
    private alertModel;
    constructor(alertModel: Model<AlertDocument>);
    create(createAlertDto: any): Promise<Alert>;
    findAll(): Promise<Alert[]>;
    findOne(id: string): Promise<Alert>;
    findByStudent(studentId: string): Promise<Alert[]>;
    findByInstructor(instructorId: string): Promise<Alert[]>;
    findUnresolved(): Promise<Alert[]>;
    update(id: string, updateAlertDto: any): Promise<Alert>;
    resolve(id: string): Promise<Alert>;
    remove(id: string): Promise<void>;
    count(): Promise<number>;
}
