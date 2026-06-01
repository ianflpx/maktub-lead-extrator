require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!global.__maktubMongo) {
    global.__maktubMongo = {
        connection: null,
        promise: null
    };
}

async function connectToDatabase() {
    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI nao configurada. Configure essa variavel no .env local e nas Environment Variables da Vercel.');
    }

    if (mongoose.connection.readyState === 1) {
        return mongoose;
    }

    if (global.__maktubMongo.connection) {
        return global.__maktubMongo.connection;
    }

    if (!global.__maktubMongo.promise) {
        global.__maktubMongo.promise = mongoose.connect(MONGODB_URI, {
            family: 4,
            maxPoolSize: 5,
            serverSelectionTimeoutMS: 8000
        })
            .then((connectedMongoose) => {
                global.__maktubMongo.connection = connectedMongoose;
                return connectedMongoose;
            })
            .catch((error) => {
                global.__maktubMongo.promise = null;
                throw error;
            });
    }

    return global.__maktubMongo.promise;
}

module.exports = {
    connectToDatabase,
    mongoose
};
