const mongoose = require('mongoose');

async function cleanup() {
  await mongoose.connect('mongodb://127.0.0.1:27017/user-management');
  console.log('Connected to MongoDB');

  const ClassEnrollment = mongoose.model('ClassEnrollment', new mongoose.Schema({
    studentId: mongoose.Schema.Types.ObjectId,
    schoolClassId: mongoose.Schema.Types.ObjectId
  }));

  const all = await ClassEnrollment.find();
  console.log(`Initial count: ${all.length}`);

  const seen = new Set();
  const toDelete = [];

  for (const e of all) {
    const key = e.studentId.toString();
    if (seen.has(key)) {
      toDelete.push(e._id);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length > 0) {
    console.log(`Deleting ${toDelete.length} duplicates...`);
    await ClassEnrollment.deleteMany({ _id: { $in: toDelete } });
  }

  console.log('Cleanup complete.');
  process.exit(0);
}

cleanup().catch(err => {
  console.error(err);
  process.exit(1);
});
