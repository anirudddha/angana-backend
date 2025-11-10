import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  createListingController,
  searchListingsController,
  getListingByIdController,
  getMyListingsController,
  updateListingController,
  deleteListingController,
  getAllListingsController,
  updateListingStatusController,
  deleteListingAdminController
} from '../controllers/marketplace.controller.js';

const router = Router();
router.use(authenticate);

// User routes for managing their own listings
router.get('/my-listings', getMyListingsController); // GET /marketplace/my-listings - Get all my listings/offers

// Admin routes (all listings management)
router.get('/admin/all', getAllListingsController); // GET /marketplace/admin/all - Get all listings with filters

// General routes
router.route('/')
  .post(createListingController) // POST /marketplace - Create a new listing
  .get(searchListingsController); // GET /marketplace - Search listings

// Routes for a specific listing
router.route('/:id')
  .get(getListingByIdController) // GET /marketplace/:id - Get listing by ID
  .put(updateListingController) // PUT /marketplace/:id - Update listing (seller only)
  .patch(updateListingController) // PATCH /marketplace/:id - Update listing (seller only)
  .delete(deleteListingController); // DELETE /marketplace/:id - Delete listing (seller only)

// Admin routes for specific listing management
router.route('/admin/:id')
  .patch(updateListingStatusController) // PATCH /marketplace/admin/:id - Update listing status (admin)
  .delete(deleteListingAdminController); // DELETE /marketplace/admin/:id - Delete listing (admin)

export default router;