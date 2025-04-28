import express, { Express, Request, Response, NextFunction } from 'express';
import * as http from 'http'; 
import * as dotenv from 'dotenv';
import cors from 'cors';
import { createProxyMiddleware, Options, Filter } from 'http-proxy-middleware';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

const dataProcessingUrl = process.env.DATA_PROCESSING_URL;
const aiServiceUrl = process.env.AI_SERVICE_URL;

if (!dataProcessingUrl) {
  console.error('FATAL ERROR: DATA_PROCESSING_URL is not defined in the environment variables.');
  process.exit(1);
}
if (!aiServiceUrl) {
  console.error('FATAL ERROR: AI_SERVICE_URL is not defined in the environment variables.');
  process.exit(1);
}

const allowedOrigins = ['http://localhost:5173']; 
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

const proxyOptionsBase: Partial<Options> = {
  changeOrigin: true,
  selfHandleResponse: true, 
};

app.use('/api/styles', createProxyMiddleware({
    ...proxyOptionsBase,
    target: dataProcessingUrl,
    pathRewrite: { '^/': '/api/styles' },
    on: {
        proxyReq: (proxyReq, req, _res) => {
             console.log(`[proxy]: STYLES Request forwarded: ${req.method} ${proxyReq.path}`);
        },
        proxyRes: (proxyRes, _req, res) => {
            console.log(`[proxy]: STYLES Response received: ${proxyRes.statusCode}`);
            Object.keys(proxyRes.headers).forEach((key) => {
                res.setHeader(key, proxyRes.headers[key] as string | string[]);
            });
            res.writeHead(proxyRes.statusCode ?? 500);
            proxyRes.pipe(res);
        },
        error: (err, _req, res) => {
            console.error('[Styles Proxy Error]:', err);
            if (res instanceof http.ServerResponse && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
            }
            if (res instanceof http.ServerResponse) {
              res.end(JSON.stringify({ message: 'Proxy error connecting to Data Processing service', error: err.message }));
            }
        }
    }
}));

app.use('/api/transform', createProxyMiddleware({
    ...proxyOptionsBase,
    target: aiServiceUrl,
    pathRewrite: { [`^/api/transform`]: '/transform' },
    on: {
        proxyReq: (proxyReq, req, _res) => {
             console.log(`[proxy]: TRANSFORM Request forwarded: ${req.method} ${proxyReq.path}`);
        },
        proxyRes: (proxyRes, _req, res) => {
            console.log(`[proxy]: TRANSFORM Response received: ${proxyRes.statusCode}`);
            Object.keys(proxyRes.headers).forEach((key) => {
                res.setHeader(key, proxyRes.headers[key] as string | string[]);
            });
            res.writeHead(proxyRes.statusCode ?? 500);
            proxyRes.pipe(res);
        },
        error: (err, _req, res) => {
            console.error('[Transform Proxy Error]:', err);
             if (res instanceof http.ServerResponse && !res.headersSent) {
                 res.writeHead(502, { 'Content-Type': 'application/json' });
             }
             if (res instanceof http.ServerResponse) {
               res.end(JSON.stringify({ message: 'Proxy error connecting to AI service', error: err.message }));
             }
        }
    }
}));

app.get('/gateway/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'API Gateway is running' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Gateway Error]:', err.stack);
  if (err.message === 'Not allowed by CORS') {
      return res.status(403).json({ message: err.message });
  }
  if (!res.headersSent) {
    res.status(500).json({ message: 'API Gateway Internal Error', error: err.message });
  }
});

app.listen(port, () => {
  console.log(`[server]: API Gateway is running at http://localhost:${port}`);
  console.log(`[proxy]: /api/styles -> ${dataProcessingUrl}`);
  console.log(`[proxy]: /api/transform -> ${aiServiceUrl}`);
});
