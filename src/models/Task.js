const mongoose = require('mongoose');

// Domain vocabulary from CONTEXT.md — do not use other terms
const VALID_STATUSES = ['Todo', 'In Progress', 'In Review', 'Done'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High'];

const TaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: VALID_STATUSES,
      default: 'Todo',
    },
    priority: {
      type: String,
      enum: VALID_PRIORITIES,
      default: 'Medium',
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Export enums so controllers can validate against the same source of truth
TaskSchema.statics.VALID_STATUSES = VALID_STATUSES;
TaskSchema.statics.VALID_PRIORITIES = VALID_PRIORITIES;

module.exports = mongoose.model('Task', TaskSchema);
