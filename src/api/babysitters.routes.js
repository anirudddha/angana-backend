import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  setMyBabysitterProfileController,
  removeMyBabysitterProfileController,
  getNeighborhoodBabysittersController,
  getBabysitterDetailsController,
  createRecommendationController,
} from '../controllers/babysitters.controller.js';

const router = Router();
router.use(authenticate); // Protect all routes

// For a user to manage their OWN babysitter profile
router.route('/me')
  .post(setMyBabysitterProfileController) // Create or update
  .delete(removeMyBabysitterProfileController); // Opt-out

// For parents to find babysitters
router.get('/neighborhood/:id', getNeighborhoodBabysittersController);

// For interacting with a specific babysitter's profile
router.route('/:id')
  .get(getBabysitterDetailsController);
  
// For adding a recommendation to a specific babysitter
router.post('/:id/recommendations', createRecommendationController);

export default router;