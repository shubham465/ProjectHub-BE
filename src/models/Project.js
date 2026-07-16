const mongoose = require('mongoose');

// Default column order matches CONTEXT.md task statuses
const DEFAULT_COLUMNS = ['Todo', 'In Progress', 'In Review', 'Done'];

const ProjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    columns: {
      type: [String],
      default: DEFAULT_COLUMNS,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', ProjectSchema);

