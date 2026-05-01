const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { AcademicService } = require('./dist/academic/academic.service');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const academicService = app.get(AcademicService);
  
  const objectId = academicService.toObjectId('69e28dd1ad31870579bd8406');
  const explicitAssignments = await academicService.classInstructorModel.find({ instructorId: objectId }).exec();
  const classIdsExplicit = explicitAssignments.map((ca) => ca.schoolClassId);
  const uniqueClassIds = [...new Set([...classIdsExplicit].map((id) => String(id)))];
  
  console.log('uniqueClassIds array of strings:', uniqueClassIds);
  
  const classes = await academicService.schoolClassModel.find({ _id: { $in: uniqueClassIds } }).exec();
  console.log('Found with array of strings:', classes.length);
  
  const uniqueClassIdsObjects = uniqueClassIds.map(id => academicService.toObjectId(id));
  const classes2 = await academicService.schoolClassModel.find({ _id: { $in: uniqueClassIdsObjects } }).exec();
  console.log('Found with array of ObjectIds:', classes2.length);
  
  process.exit();
}
bootstrap();
