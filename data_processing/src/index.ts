import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import stylesRouter from './routes/styles.routes';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json());

app.use('/api', stylesRouter);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

app.listen(port, () => {
  console.log(`[server]: Data Processing Server is running at http://localhost:${port}`);
});
