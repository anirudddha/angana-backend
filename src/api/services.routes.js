import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  getCategoriesController,
  searchServicesController,
  createRecommendationController,
  getRecommendationsController,
} from '../controllers/services.controller.js';

const router = Router();
router.use(authenticate); // Protect all routes

router.get('/categories', getCategoriesController);
router.get('/search', searchServicesController);

// Routes for recommendations are nested under a business context
router.route('/business/:businessId/recommendations')
    .post(createRecommendationController)
    .get(getRecommendationsController);

export default router;