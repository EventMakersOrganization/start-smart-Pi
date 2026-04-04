const mongoose = require('mongoose');

async function checkDb() {
    await mongoose.connect('mongodb://127.0.0.1:27017/user-management');
    const db = mongoose.connection.db;
    const sessions = await db.collection('gamesessions').find({}).toArray();

    if (sessions.length > 0) {
        const p = sessions[0].players[0];
        console.log('Type of player ID in DB:', typeof p);
        console.log('Is instance of ObjectId?', p instanceof mongoose.Types.ObjectId);
        console.log('Raw value:', p);
        console.log('Mode:', sessions[0].mode);
    } else {
        console.log('No sessions found');
    }

    await mongoose.disconnect();
}

checkDb();
