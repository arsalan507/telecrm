// models/Contact.js
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String
    },
    status: {
        type: String,
        enum: ['new', 'contacted', 'interested', 'converted', 'not_interested'],
        default: 'new'
    },
    assignedAgent: {
        type: String
    },
    lastContactDate: {
        type: Date
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Contact', contactSchema);