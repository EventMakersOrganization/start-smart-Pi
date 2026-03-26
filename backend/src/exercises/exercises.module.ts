import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Exercise, ExerciseSchema } from './schemas/exercise.schema';
import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Exercise.name, schema: ExerciseSchema }]),
        AuthModule,
    ],
    controllers: [ExercisesController],
    providers: [ExercisesService],
    exports: [ExercisesService],
})
export class ExercisesModule { }
