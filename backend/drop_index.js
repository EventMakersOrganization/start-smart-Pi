const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://localhost/user-management');
  console.log('Connected to MongoDB');
  try {
    const result = await mongoose.connection.db.collection('attendances').dropIndex('schoolClassId_1_date_1');
    console.log('Dropped old index:', result);
  } catch (err) {
    console.log('Index might not exist or another error:', err.message);
  }
  process.exit(0);
}

run().catch(console.error);
