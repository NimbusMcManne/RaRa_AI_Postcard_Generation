import { Router } from 'express';
import { getStyles } from '../controllers/styles.controller';

const router = Router();

router.get('/styles', getStyles);

export default router;
