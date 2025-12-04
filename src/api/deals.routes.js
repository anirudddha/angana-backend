// src/routes/deals.routes.js  (edit the file you already showed)
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { checkVerifiedBusiness } from '../middleware/checkVerifiedBusiness.js';
import {
  createDealController,
  getDealsForNeighborhoodController,
  updateDealController, // <-- add this import
  getDealByIdController,
  getMyDealsController
} from '../controllers/deals.controller.js';
// TODO: Add Zod validation schemas

const router = Router();

// All routes require a user to be logged in
router.use(authenticate);

// Route for creating a deal - requires a verified business account
router.post('/', checkVerifiedBusiness, createDealController);

// Route for updating a deal - requires verified business and ownership
router.put('/:id', checkVerifiedBusiness, updateDealController); // <-- new route

// Route for fetching deals - any logged-in user can access this
router.get('/neighborhood', getDealsForNeighborhoodController);

router.get('/my', checkVerifiedBusiness, getMyDealsController);

router.get('/:id', getDealByIdController);



export default router;
