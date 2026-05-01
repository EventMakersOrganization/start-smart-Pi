const { MongoClient } = require('mongodb');

async function query() {
  const uri = "mongodb://127.0.0.1:27017/user-management";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('user-management');
    
    const attendances = await db.collection('attendances').find({}).toArray();
    console.log("Attendances:");
    attendances.forEach(a => {
      console.log(`- Date: ${a.date}, Session: ${a.sessionType}, Total Records: ${a.records.length}`);
      console.log(`  Records: ${JSON.stringify(a.records)}`);
    });

    const profiles = await db.collection('studentprofiles').find({}).toArray();
    console.log("\nStudent Profiles:");
    profiles.forEach(p => {
      console.log(`- User: ${p.userId}, %: ${p.attendance_percentage}`);
    });

  } finally {
    await client.close();
  }
}

query().catch(console.dir);
