import asyncHandler from 'express-async-handler';
import * as categoryService from '../services/category.service.js';

export const createCategoryController = asyncHandler(async (req, res) => {
  const { name, icon, color } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Category name is required.');
  }

  const category = await categoryService.createCategory({ name, icon, color });
  res.status(201).json(category);
});

export const getCategoriesController = asyncHandler(async (req, res) => {
  const categories = await categoryService.getCategories();
  res.status(200).json(categories);
});

export const getCategoryByIdController = asyncHandler(async (req, res) => {
  const categoryId = parseInt(req.params.id);
  const category = await categoryService.getCategoryById(categoryId);

  if (!category) {
    res.status(404);
    throw new Error('Category not found.');
  }

  res.status(200).json(category);
});

export const updateCategoryController = asyncHandler(async (req, res) => {
  const categoryId = parseInt(req.params.id);
  const { name, icon, color } = req.body;

  const updatedCategory = await categoryService.updateCategory(categoryId, { name, icon, color });

  if (!updatedCategory) {
    res.status(404);
    throw new Error('Category not found.');
  }

  res.status(200).json(updatedCategory);
});

export const deleteCategoryController = asyncHandler(async (req, res) => {
  const categoryId = parseInt(req.params.id);
  await categoryService.deleteCategory(categoryId);
  res.status(204).send(); // No content
});