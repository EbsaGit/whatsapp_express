const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ChatSchema = new Schema({
  phone: { type: String, required: true },
  contact: { type: String, required: false },
  zcrm_owner: { type: String, default: "Admin" },
  created_time: { type: Date, default: Date.now },
  lastResponseTime: { type: Date },
  unreadMessages: { type: Boolean, default: false }
});

module.exports = mongoose.model('chats', ChatSchema, 'chats');
