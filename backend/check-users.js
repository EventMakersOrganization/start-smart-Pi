const { MongoClient } = require('mongodb');

async function run() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  try {
    await client.connect();
    const db = client.db('user-management');
    const users = await db.collection('users').find({}).toArray();
    console.log("=== DB DUMP ===");
    console.log(JSON.stringify(users.map(u => ({ id: u._id, role: u.role, first_name: u.first_name, last_name: u.last_name })), null, 2));
    console.log("=== END DUMP ===");
  } catch(e) {
    console.error("MONGO ERROR:", e);
  } finally {
    await client.close();
  }
}

run();
