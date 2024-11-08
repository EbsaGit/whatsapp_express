const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ChatSchema = new Schema({
  phone: { type: String, required: true },
  contact: { type: String, required: false },
  zcrm_lead_id: { type: String, default: "99999999999999999999" },
  zcrm_contact_id: { type: String, default: "99999999999999999999" },
  zcrm_contact_owner: { type: String, default: "99999999999999999999" },
  zcrm_lead_owner: { type: String, default: "99999999999999999999" },
  created_time: { type: Date, default: Date.now },
  lastResponseTime: { type: Date },
  unreadMessages: { type: Boolean, default: false }
});

module.exports = mongoose.model('chats', ChatSchema, 'chats');
