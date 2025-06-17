const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
  },
  callType: {
    type: String,
    enum: ['incoming', 'outgoing', 'missed'],
    required: true,
  },
  duration: Number, // in seconds
  timestamp: {
    type: Date,
    default: Date.now,
  },
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
  },
  recordedBy: String, // Agent name or device ID
  notes: String
});

module.exports = mongoose.model('CallLog', callLogSchema);
