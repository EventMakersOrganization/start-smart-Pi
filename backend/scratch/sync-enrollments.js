const mongoose = require('mongoose');

async function sync() {
  await mongoose.connect('mongodb://127.0.0.1:27017/user-management');
  console.log('Connected to MongoDB');

  const UserSchema = new mongoose.Schema({
    role: String
  });
  const User = mongoose.model('User', UserSchema);

  const StudentProfileSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    class: String
  });
  const StudentProfile = mongoose.model('StudentProfile', StudentProfileSchema);

  const SchoolClassSchema = new mongoose.Schema({
    name: String
  });
  const SchoolClass = mongoose.model('SchoolClass', SchoolClassSchema);

  const ClassEnrollmentSchema = new mongoose.Schema({
    studentId: mongoose.Schema.Types.ObjectId,
    schoolClassId: mongoose.Schema.Types.ObjectId,
    enrolledAt: { type: Date, default: Date.now }
  });
  const ClassEnrollment = mongoose.model('ClassEnrollment', ClassEnrollmentSchema);

  const profiles = await StudentProfile.find({ class: { $exists: true, $ne: null, $ne: '' } });
  console.log(`Found ${profiles.length} student profiles with a class assigned.`);

  for (const profile of profiles) {
    if (!profile.class) continue;
    const className = String(profile.class).trim();
    const schoolClass = await SchoolClass.findOne({ name: className });
    
    if (!schoolClass) {
      console.log(`Warning: Class "${className}" not found for student ${profile.userId}`);
      continue;
    }

    const existingEnrollment = await ClassEnrollment.findOne({ 
      studentId: profile.userId, 
      schoolClassId: schoolClass._id 
    });

    if (!existingEnrollment) {
      // Check if student is enrolled in ANOTHER class
      const otherEnrollment = await ClassEnrollment.findOne({ studentId: profile.userId });
      if (otherEnrollment) {
        console.log(`Updating enrollment for student ${profile.userId} from ${otherEnrollment.schoolClassId} to ${schoolClass._id}`);
        otherEnrollment.schoolClassId = schoolClass._id;
        await otherEnrollment.save();
      } else {
        console.log(`Creating NEW enrollment for student ${profile.userId} in class "${className}"`);
        await ClassEnrollment.create({
          studentId: profile.userId,
          schoolClassId: schoolClass._id
        });
      }
    }
  }

  console.log('Synchronization complete.');
  process.exit(0);
}

sync().catch(err => {
  console.error(err);
  process.exit(1);
});
