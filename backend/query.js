const { MongoClient } = require('mongodb');

async function query() {
  const uri = "mongodb://127.0.0.1:27017/user-management";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const collection = client.db('user-management').collection('attendances');

    const docs = await collection.find({}).toArray();
    console.log(JSON.stringify(docs, null, 2));
  } finally {
    await client.close();
  }
}

query().catch(console.dir);
