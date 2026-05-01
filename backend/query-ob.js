const { MongoClient } = require('mongodb');

async function query() {
  const uri = "mongodb://127.0.0.1:27017/user-management";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('user-management');
    
    const users = await db.collection('users').find({}).toArray();
    const obUser = users.find(u => u.first_name === 'oussema' && u.last_name === 'bani');
    console.log("Oussema user ID:", obUser ? obUser._id : "Not found");

    const profiles = await db.collection('studentprofiles').find({ userId: obUser._id }).toArray();
    console.log("Oussema Profiles:", profiles.length);
    profiles.forEach(p => console.log(p));

  } finally {
    await client.close();
  }
}

query().catch(console.dir);
