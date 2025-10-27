import { Response } from 'express';
import SavedInput from '../models/savedInput.model.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

// @desc    Create a new saved input
// @route   POST /api/saved-inputs
// @access  Private
export const createSavedInput = async (req: AuthRequest, res: Response) => {
  try {
    const { name, formData } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({ message: 'Form data is required' });
    }

    const savedInput = new SavedInput({
      user: req.userId,
      name: name.trim(),
      formData,
    });

    await savedInput.save();

    res.status(201).json({
      message: 'Input saved successfully',
      data: savedInput,
    });
  } catch (error: any) {
    console.error('Error creating saved input:', error);
    res.status(500).json({ message: error?.message || 'Failed to save input' });
  }
};

// @desc    Get all saved inputs for current user
// @route   GET /api/saved-inputs
// @access  Private
export const getSavedInputs = async (req: AuthRequest, res: Response) => {
  try {
    const savedInputs = await SavedInput.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.status(200).json({
      message: 'Saved inputs fetched successfully',
      data: savedInputs,
    });
  } catch (error: any) {
    console.error('Error fetching saved inputs:', error);
    res.status(500).json({ message: error?.message || 'Failed to fetch saved inputs' });
  }
};

// @desc    Get a single saved input by ID
// @route   GET /api/saved-inputs/:id
// @access  Private
export const getSavedInputById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const savedInput = await SavedInput.findOne({
      _id: id,
      user: req.userId,
    }).select('-__v');

    if (!savedInput) {
      return res.status(404).json({ message: 'Saved input not found' });
    }

    res.status(200).json({
      message: 'Saved input fetched successfully',
      data: savedInput,
    });
  } catch (error: any) {
    console.error('Error fetching saved input:', error);
    res.status(500).json({ message: error?.message || 'Failed to fetch saved input' });
  }
};

// @desc    Update a saved input
// @route   PUT /api/saved-inputs/:id
// @access  Private
export const updateSavedInput = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, formData } = req.body;

    const savedInput = await SavedInput.findOne({
      _id: id,
      user: req.userId,
    });

    if (!savedInput) {
      return res.status(404).json({ message: 'Saved input not found' });
    }

    if (name && name.trim()) {
      savedInput.name = name.trim();
    }

    if (formData && typeof formData === 'object') {
      savedInput.formData = formData;
    }

    await savedInput.save();

    res.status(200).json({
      message: 'Input updated successfully',
      data: savedInput,
    });
  } catch (error: any) {
    console.error('Error updating saved input:', error);
    res.status(500).json({ message: error?.message || 'Failed to update input' });
  }
};

// @desc    Delete a saved input
// @route   DELETE /api/saved-inputs/:id
// @access  Private
export const deleteSavedInput = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const savedInput = await SavedInput.findOneAndDelete({
      _id: id,
      user: req.userId,
    });

    if (!savedInput) {
      return res.status(404).json({ message: 'Saved input not found' });
    }

    res.status(200).json({
      message: 'Input deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting saved input:', error);
    res.status(500).json({ message: error?.message || 'Failed to delete input' });
  }
};
