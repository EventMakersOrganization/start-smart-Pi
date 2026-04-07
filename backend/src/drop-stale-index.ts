import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
    console.log('--- STARTING STALE INDEX DROP ---');
    try {
        const app = await NestFactory.createApplicationContext(AppModule);
        const profileModel = app.get(getModelToken('StudentProfile')) as Model<any>;

        console.log('Fetching indexes for collection:', profileModel.collection.name);
        const indexes = await profileModel.collection.indexes();
        console.log('Current indexes:', indexes.map(idx => idx.name));

        const badIndex = 'user_1';
        if (indexes.some(idx => idx.name === badIndex)) {
            console.log(`Found index '${badIndex}', attempting to drop...`);
            await profileModel.collection.dropIndex(badIndex);
            console.log(`SUCCESS: Index '${badIndex}' dropped.`);
        } else {
            console.log(`INFO: Index '${badIndex}' not found.`);
        }

        await app.close();
        console.log('--- FINISHED ---');
        process.exit(0);
    } catch (err) {
        console.error('--- FATAL ERROR ---', err);
        process.exit(1);
    }
}

bootstrap();
