const mongoose = require('mongoose');

async function checkDb() {
    await mongoose.connect('mongodb://127.0.0.1:27017/user-management');
    const db = mongoose.connection.db;
    const pSessions = await db.collection('playersessions').find({}).toArray();

    if (pSessions.length > 0) {
        const s = pSessions[0];
        console.log('PlayerSession[0] userId:', s.userId, typeof s.userId);
        console.log('PlayerSession[0] gameSessionId:', s.gameSessionId, typeof s.gameSessionId);
    } else {
        console.log('No player sessions found');
    }

    await mongoose.disconnect();
}

checkDb();
