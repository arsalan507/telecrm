const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema({
    // Basic Call Information
    phoneNumber: {
        type: String,
        required: true,
        trim: true,
        index: true // For faster queries
    },
    contactName: {
        type: String,
        default: 'Unknown',
        trim: true
    },
    duration: {
        type: Number, // Duration in seconds
        required: true,
        min: 0
    },
    callType: {
        type: String,
        required: true,
        enum: ['incoming', 'outgoing', 'missed'],
        index: true
    },
    timestamp: {
        type: Date,
        required: true,
        default: Date.now,
        index: true // For date range queries
    },
    
    // SIM & Device Information
    simSlot: {
        type: Number,
        default: 1, // For dual SIM phones
        min: 1,
        max: 2
    },
    deviceInfo: {
        brand: String,
        model: String,
        androidVersion: String
    },
    
    // AI-Ready Fields
    transcription: {
        text: String,
        confidence: Number, // 0-1 score from Whisper
        language: {
            type: String,
            default: 'en'
        },
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: 'pending'
        }
    },
    sentiment: {
        score: Number, // -1 to 1 (negative to positive)
        label: {
            type: String,
            enum: ['positive', 'negative', 'neutral']
        },
        confidence: Number // 0-1 confidence score
    },
    
    // Call Analysis
    callQuality: {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        notes: String
    },
    tags: [{
        type: String,
        lowercase: true,
        trim: true
    }],
    
    // Business Intelligence
    leadStatus: {
        type: String,
        enum: ['new', 'qualified', 'contacted', 'converted', 'lost'],
        default: 'new'
    },
    followUpDate: Date,
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    
    // Audio File (for future transcription)
    audioFile: {
        filename: String,
        path: String,
        size: Number, // in bytes
        format: String // mp3, wav, etc.
    },
    
    // Metadata
    source: {
        type: String,
        default: 'android_app'
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for performance
callLogSchema.index({ phoneNumber: 1, timestamp: -1 });
callLogSchema.index({ callType: 1, timestamp: -1 });
callLogSchema.index({ 'sentiment.label': 1 });
callLogSchema.index({ leadStatus: 1 });

// Update the updatedAt field before saving
callLogSchema.pre('save', function(next) {
    if (this.isModified() && !this.isNew) {
        this.updatedAt = Date.now();
    }
    next();
});

// Virtual for call duration in human-readable format
callLogSchema.virtual('durationFormatted').get(function() {
    const minutes = Math.floor(this.duration / 60);
    const seconds = this.duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Virtual for relative time
callLogSchema.virtual('timeAgo').get(function() {
    const now = new Date();
    const diffMs = now - this.timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
});

// Instance methods
callLogSchema.methods.markAsProcessed = function(transcriptionData) {
    this.transcription.text = transcriptionData.text;
    this.transcription.confidence = transcriptionData.confidence;
    this.transcription.status = 'completed';
    return this.save();
};

callLogSchema.methods.updateSentiment = function(sentimentData) {
    this.sentiment.score = sentimentData.score;
    this.sentiment.label = sentimentData.label;
    this.sentiment.confidence = sentimentData.confidence;
    return this.save();
};

// Static methods for analytics
callLogSchema.statics.getCallStats = function(dateRange) {
    return this.aggregate([
        {
            $match: {
                timestamp: {
                    $gte: dateRange.start,
                    $lte: dateRange.end
                },
                isDeleted: false
            }
        },
        {
            $group: {
                _id: '$callType',
                count: { $sum: 1 },
                totalDuration: { $sum: '$duration' },
                avgDuration: { $avg: '$duration' }
            }
        }
    ]);
};

callLogSchema.statics.getSentimentTrends = function() {
    return this.aggregate([
        {
            $match: {
                'sentiment.label': { $exists: true },
                isDeleted: false
            }
        },
        {
            $group: {
                _id: '$sentiment.label',
                count: { $sum: 1 },
                avgScore: { $avg: '$sentiment.score' }
            }
        }
    ]);
};

// Ensure virtual fields are serialized
callLogSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('CallLog', callLogSchema);