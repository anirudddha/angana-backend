import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { checkVerifiedBusiness } from '../middleware/checkVerifiedBusiness.js';
import {
  getCategoriesController,
  searchServicesController,
  createRecommendationController,
  getRecommendationsController,

  // new controllers
  getBusinessServicesController,
  getMyServicesController,
  createBusinessServiceController,
  updateBusinessServiceController,
  deleteBusinessServiceController,
} from '../controllers/services.controller.js';

const router = Router();
router.use(authenticate); // Protect all routes

router.get('/categories', getCategoriesController);
router.get('/search', searchServicesController);

// Recommendations (existing)
router.route('/business/:businessId/recommendations')
  .post(createRecommendationController)
  .get(getRecommendationsController);

// New: service CRUD for business owners + public listing
// Public (any authenticated user can view business services)
router.get('/business/:businessId/services', getBusinessServicesController);

// Owner-only: manage services (requires checkVerifiedBusiness)
router.get('/me/business/services', checkVerifiedBusiness, getMyServicesController);
router.post('/business/:businessId/services', checkVerifiedBusiness, createBusinessServiceController);
router.put('/business/:businessId/services/:serviceId', checkVerifiedBusiness, updateBusinessServiceController);
router.delete('/business/:businessId/services/:serviceId', checkVerifiedBusiness, deleteBusinessServiceController);

export default router;
