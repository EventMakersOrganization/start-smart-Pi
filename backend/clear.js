const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://localhost/user-management');
  console.log('Connected to MongoDB');
  const result = await mongoose.connection.db.collection('attendances').deleteMany({});
  console.log('Deleted attendance records:', result);
  process.exit(0);
}

run().catch(console.error);
