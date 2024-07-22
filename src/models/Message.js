const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  recipient_phone: { type: String, required: false },
  message_id: { type: String, required: false },
  contact: { type: String, required: false },
  display_phone_number: { type: String, required: false },
  display_phone_number_id: { type: String, required: false },
  conversation_id: { type: String, required: false },
  message_text: { type: String, required: false },
  type: { type: String, required: false },
  created_time: { type: Date, default: Date.now }
});

module.exports = mongoose.model('messages', MessageSchema,'messages');
