// src/routes/pets.router.js
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  createPetController,
  updatePetController,
  deletePetController,
  getPetDetailsController,
  getNeighborhoodPetsController,
  getLostNeighborhoodPetsController,
  getMyPetsController, // ADDED
} from '../controllers/pets.controller.js';

const router = Router();
router.use(authenticate); // Protect all pet routes

// For creating a pet for the logged-in user
router.route('/')
  .post(createPetController);

// ADDED: For the logged-in user to get a list of all their own pets.
// This must come before the '/:id' route.
router.get('/me', getMyPetsController);

// For getting a directory of pets in a neighborhood
router.get('/neighborhood/:id', getNeighborhoodPetsController);
router.get('/neighborhood/:id/lost', getLostNeighborhoodPetsController);

// For interacting with a specific pet profile
router.route('/:id')
  .get(getPetDetailsController)
  .patch(updatePetController) // This is the "edit" route
  .delete(deletePetController);

export default router;