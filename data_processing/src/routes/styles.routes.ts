import { Router } from 'express';
import { getStyles, getStyleReferences, getLocalTestStyles } from '../controllers/styles.controller';

const router = Router();

router.get('/styles', getStyles);

router.get('/styles/:periodId/:categoryId/references', getStyleReferences);

router.get('/local-test-styles', getLocalTestStyles);

export default router;
