const mongoose = require('mongoose');

let connectionPromise = null;

async function connectToDatabase() {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI nao configurada');
    }

    if (mongoose.connection.readyState === 1) {
        return mongoose;
    }

    if (!connectionPromise) {
        connectionPromise = mongoose.connect(process.env.MONGODB_URI, { family: 4 })
            .catch((error) => {
                connectionPromise = null;
                throw error;
            });
    }

    await connectionPromise;
    return mongoose;
}

module.exports = {
    connectToDatabase,
    mongoose
};
