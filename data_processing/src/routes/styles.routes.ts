import { Router } from 'express';
import { getStyles, getStyleReferences } from '../controllers/styles.controller';

const router = Router();

router.get('/styles', getStyles);

router.get('/styles/:periodId/:categoryId/references', getStyleReferences);

export default router;
