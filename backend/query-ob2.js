const { MongoClient } = require('mongodb');

async function query() {
  const uri = "mongodb://127.0.0.1:27017/user-management";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('user-management');
    
    const obIdStr = "69e8952c83e1339f59148388";
    const profiles = await db.collection('studentprofiles').find({ userId: obIdStr }).toArray();
    console.log("String Profiles:", profiles.length);

  } finally {
    await client.close();
  }
}

query().catch(console.dir);
