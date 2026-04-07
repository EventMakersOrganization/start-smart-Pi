const { MongoClient } = require('mongodb');

async function main() {
    const uri = "mongodb://127.0.0.1:27017/user-management";
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('user-management');
        const collection = db.collection('studentprofiles');

        console.log('Connected. Fetching indexes...');
        const indexes = await collection.indexes();
        console.log('Indexes found:', indexes.map(idx => idx.name));

        if (indexes.some(idx => idx.name === 'user_1')) {
            console.log('Dropping stale unique index: user_1');
            await collection.dropIndex('user_1');
            console.log('Successfully dropped user_1.');
        } else {
            console.log('Index user_1 not found. Nothing to do.');
        }

    } catch (err) {
        console.error('Error during index drop:', err);
    } finally {
        await client.close();
        process.exit(0);
    }
}

main();
