const mongoose = require('mongoose');

const dbURI = 'mongodb://sacst:HOLA94mundo@159.203.75.60:27017/mywhatsappdb';

const connectDB = async () => {
  try {
    await mongoose.connect(dbURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

module.exports = connectDB;