const { MongoClient } = require('mongodb');

async function drop() {
  const uri = "mongodb://127.0.0.1:27017/user-management";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const collection = client.db('user-management').collection('attendances');
    await collection.deleteMany({});
    console.log("All old attendance test data deleted.");
  } finally {
    await client.close();
  }
}

drop().catch(console.dir);
