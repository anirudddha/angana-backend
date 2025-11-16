import express from 'express';
import {
  createCategoryController,
  getCategoriesController,
  getCategoryByIdController,
  updateCategoryController,
  deleteCategoryController,
} from '../controllers/category.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

router.route('/')
  .post(authenticate, createCategoryController)
  .get(getCategoriesController);

router.route('/:id')
  .get(getCategoryByIdController)
  .put(authenticate, updateCategoryController)
  .delete(authenticate, deleteCategoryController);

export default router;