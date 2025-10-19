import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  createPetController,
  updatePetController,
  deletePetController,
  getPetDetailsController,
  getNeighborhoodPetsController,
  getLostNeighborhoodPetsController,
} from '../controllers/pets.controller.js';

const router = Router();
router.use(authenticate); // Protect all pet routes

// For creating a pet for the logged-in user
router.route('/')
  .post(createPetController);

// For getting a directory of pets in a neighborhood
router.get('/neighborhood/:id', getNeighborhoodPetsController);
router.get('/neighborhood/:id/lost', getLostNeighborhoodPetsController);

// For interacting with a specific pet profile
router.route('/:id')
  .get(getPetDetailsController)
  .patch(updatePetController)
  .delete(deletePetController);

export default router;