// routes/contacts.js
const express = require('express');
const Contact = require('../models/Contact');
const router = express.Router();

// Get all contacts
router.get('/', async (req, res) => {
    try {
        const contacts = await Contact.find();
        res.json(contacts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add new contact
router.post('/', async (req, res) => {
    try {
        const contact = new Contact(req.body);
        const savedContact = await contact.save();
        res.status(201).json(savedContact);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;