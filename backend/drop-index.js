const { MongoClient } = require('mongodb');

async function dropIndex() {
  const uri = "mongodb://127.0.0.1:27017/user-management";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('user-management');
    const collection = database.collection('attendances');

    const indexes = await collection.indexes();
    console.log("Current indexes:", indexes.map(i => i.name));

    if (indexes.find(i => i.name === 'schoolClassId_1_date_1')) {
      console.log("Dropping index schoolClassId_1_date_1...");
      await collection.dropIndex('schoolClassId_1_date_1');
      console.log("Index dropped successfully.");
    } else {
      console.log("Index schoolClassId_1_date_1 not found.");
    }

  } finally {
    await client.close();
  }
}

dropIndex().catch(console.dir);
