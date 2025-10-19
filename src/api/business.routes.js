import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { applyForBusinessAccountController, updateBusinessController, setBusinessServicesController, getBusinessProfileController } from '../controllers/business.controller.js';
// TODO: Add Zod validation schema for the request body
import { checkVerifiedBusiness } from '../middleware/checkVerifiedBusiness.js';

const router = Router();

// All routes in this file require a user to be logged in
router.use(authenticate);

router.post('/apply', applyForBusinessAccountController);

router.put('/:id', updateBusinessController);    // <-- update business by id (owner only)
// optionally support PATCH too
router.patch('/:id', updateBusinessController);

router.get('/:id', getBusinessProfileController);

router.post('/me/services',checkVerifiedBusiness, setBusinessServicesController);

export default router;