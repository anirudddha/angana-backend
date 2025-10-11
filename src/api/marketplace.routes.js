import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { createListingController, searchListingsController,getListingByIdController } from '../controllers/marketplace.controller.js';

const router = Router();
router.use(authenticate);

router.route('/')
  .post(createListingController)
  .get(searchListingsController);

router.route('/:id')
  .get(getListingByIdController); // GET listing by ID


export default router;