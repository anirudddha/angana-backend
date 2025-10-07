import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { createListingController, searchListingsController } from '../controllers/marketplace.controller.js';

const router = Router();
router.use(authenticate);

router.route('/')
  .post(createListingController)
  .get(searchListingsController);

export default router;