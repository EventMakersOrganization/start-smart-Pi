const mongoose = require('mongoose');

async function checkDb() {
    await mongoose.connect('mongodb://127.0.0.1:27017/user-management');
    const GameSession = mongoose.model('GameSession', new mongoose.Schema({ mode: String, players: Array }, { strict: false }), 'gamesessions');
    const PlayerSession = mongoose.model('PlayerSession', new mongoose.Schema({}, { strict: false }), 'playersessions');
    const PlayerAnswer = mongoose.model('PlayerAnswer', new mongoose.Schema({}, { strict: false }), 'playeranswers');
    const Score = mongoose.model('Score', new mongoose.Schema({}, { strict: false }), 'scores');

    const sessions = await GameSession.find({});
    const playersBySession = await PlayerSession.countDocuments({});
    const answersCount = await PlayerAnswer.countDocuments({});
    const scoresCount = await Score.countDocuments({});

    console.log('--- DB SUMMARY ---');
    console.log('Total GameSessions:', sessions.length);
    const soloCount = sessions.filter(s => s.mode === 'solo').length;
    console.log('Solo GameSessions:', soloCount);

    if (sessions.length > 0) {
        console.log('Sample Session [0] players:', sessions[0].players);
        console.log('Sample Session [0] mode:', sessions[0].mode);
    }

    console.log('Total PlayerSessions:', playersBySession);
    console.log('Total PlayerAnswers:', answersCount);
    console.log('Total Scores:', scoresCount);

    await mongoose.disconnect();
}

checkDb();
