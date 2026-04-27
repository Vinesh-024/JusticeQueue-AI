const mongoose = require('mongoose');

const CaseSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['pending', 'analyzing', 'complete', 'error'],
    default: 'pending',
  },

  // AI Analysis Results
  urgencyScore: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
  complexityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
  signatureDetected: {
    type: Boolean,
    default: false,
  },
  signatureConfidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0,
  },
  signatureRegions: {
    type: Number,
    default: 0,
  },

  // Document Metadata
  extractedText: {
    type: String,
    default: '',
  },
  pageCount: {
    type: Number,
    default: 0,
  },
  wordCount: {
    type: Number,
    default: 0,
  },
  keywords: {
    type: [String],
    default: [],
  },
  caseType: {
    type: String,
    default: 'Unknown',
  },

  // Scheduling
  scheduledSlot: {
    type: Date,
    default: null,
  },
  priority: {
    type: Number,
    default: 0,
  },

  // Error handling
  errorMessage: {
    type: String,
    default: null,
  },

  // Gemini AI Analysis
  geminiSummary:              { type: String, default: null },
  geminiCaseType:             { type: String, default: null },
  geminiUrgencyReason:        { type: String, default: null },
  geminiRedFlags:             { type: [String], default: [] },
  geminiRequiredActions:      { type: [String], default: [] },
  geminiHearingPrep:          { type: String, default: null },
  geminiPriorityJustification:{ type: String, default: null },
  geminiAnalyzedAt:           { type: Date,   default: null },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual: combined priority score
CaseSchema.virtual('priorityScore').get(function () {
  if (this.urgencyScore == null || this.complexityScore == null) return 0;
  return Math.round((this.urgencyScore * 0.7) + (this.complexityScore * 0.3));
});

// Index for sorting
CaseSchema.index({ priority: -1, uploadedAt: 1 });
CaseSchema.index({ status: 1 });

module.exports = mongoose.model('Case', CaseSchema);
