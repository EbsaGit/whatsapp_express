const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  recipient_phone: { type: String, required: true },
  message_id: { type: String, required: true },
  display_phone_number: { type: String, required: true },
  display_phone_number_id: { type: String, required: true },
  conversation_id: { type: String, required: true },
  message_text: { type: String, required: true },
  type: { type: String, required: true },
  created_time: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema,'Message');
