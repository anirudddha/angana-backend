import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { setUserAddressController } from '../controllers/address.controller.js';

const router = Router();
router.use(authenticate);

router.post('/', setUserAddressController); // e.g., POST /api/v1/addresses

export default router;