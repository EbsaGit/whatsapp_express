const mongoose = require('mongoose');

const dbURI = 'mongodb://sacst:HOLA94mundo@159.203.75.60:27017/';
             
const connectDB = async () => {
  try {
    await mongoose.connect(dbURI, {dbName: 'mywhatsappdb'});
    console.log('MongoDB connected');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
