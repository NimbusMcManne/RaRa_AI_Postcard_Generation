import express, { Express, Request, Response, NextFunction } from 'express';
import * as http from 'http';
import * as dotenv from 'dotenv';
import cors from 'cors';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import multer from 'multer';
import FormData from 'form-data';
import axios, { RawAxiosResponseHeaders, AxiosResponseHeaders } from 'axios';
import fs from 'fs';

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

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const proxyOptionsBase: Partial<Options> = {
  changeOrigin: true,
  selfHandleResponse: true,
};

app.use('/api/styles/:periodId/:categoryId/references', createProxyMiddleware({
    ...proxyOptionsBase,
    target: dataProcessingUrl,
    pathRewrite: (path, req) => {
        const originalPath = (req as express.Request).originalUrl || req.url || '';
        console.log(`[pathRewrite REFERENCES] Original URL: ${originalPath}, Stripped path: ${path}`);
        return originalPath;
    },
    on: {
        proxyReq: (proxyReq, req, _res) => {
            console.log(`[proxy]: REFERENCES Request forwarded: ${req.method} ${proxyReq.path}`);
        },
        proxyRes: (proxyRes, _req, res) => {
            console.log(`[proxy]: REFERENCES Response received: ${proxyRes.statusCode}`);
            Object.keys(proxyRes.headers).forEach((key) => {
                res.setHeader(key, proxyRes.headers[key] as string | string[]);
            });
            res.writeHead(proxyRes.statusCode ?? 500);
            proxyRes.pipe(res);
        },
        error: (err, _req, res) => {
            console.error('[References Proxy Error]:', err);
            if (res instanceof http.ServerResponse && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
            }
            if (res instanceof http.ServerResponse) {
              res.end(JSON.stringify({ message: 'Proxy error connecting to Data Processing service for references', error: err.message }));
            }
        }
    }
}));

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

app.get('/api/result/:processId', createProxyMiddleware({
    ...proxyOptionsBase,
    target: aiServiceUrl,
    pathRewrite: (path, req) => {
        const processId = (req as express.Request).params.processId;
        const targetPath = `/result/${processId}`;
        console.log(`[pathRewrite RESULT] Original URL: ${(req as express.Request).originalUrl}, Rewriting to: ${targetPath}`);
        return targetPath;
    },
    on: {
        proxyReq: (proxyReq, req, _res) => {
            console.log(`[proxy]: RESULT Request forwarded: ${req.method} ${proxyReq.path}`);
        },
        proxyRes: (proxyRes, _req, res) => {
            console.log(`[proxy]: RESULT Response received: ${proxyRes.statusCode}`);
            Object.keys(proxyRes.headers).forEach((key) => {
                res.setHeader(key, proxyRes.headers[key] as string | string[]);
            });
            res.writeHead(proxyRes.statusCode ?? 500);
            proxyRes.pipe(res);
        },
        error: (err, _req, res) => {
            console.error('[Result Proxy Error]:', err);
            if (res instanceof http.ServerResponse && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
            }
            if (res instanceof http.ServerResponse) {
              res.end(JSON.stringify({ message: 'Proxy error connecting to AI service for result', error: err.message }));
            }
        }
    }
}));

app.post('/api/transform', upload.single('content_image'), async (req: Request, res: Response, next: NextFunction) => {
    console.log('[gateway]: Received /api/transform request');
    if (!req.file) {
        return res.status(400).json({ message: 'Missing content_image file' });
    }

    const { period_id, category_id } = req.body;
    const processing_mode = req.body.processing_mode || 'local';
    console.log(`[gateway]: Received period_id: ${period_id}, category_id: ${category_id}, mode: ${processing_mode}`);

    if (!period_id || !category_id) {
        return res.status(400).json({ message: 'Missing period_id or category_id' });
    }

    const formData = new FormData();
    formData.append('content_image', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
    });
    formData.append('period_id', period_id);
    formData.append('category_id', category_id);
    formData.append('processing_mode', processing_mode);

    // Add other potential parameters from original request if needed
    // formData.append('style_weight', req.body.style_weight || '1e6');
    // formData.append('content_weight', req.body.content_weight || '1.0');
    // formData.append('num_steps', req.body.num_steps || '300');

    const targetUrl = `${aiServiceUrl}/transform`;

    try {
        console.log(`[gateway]: Forwarding request to AI service at ${targetUrl}`);
        const aiResponse = await axios.post(targetUrl, formData, {
            headers: {
                ...formData.getHeaders(), // Include correct Content-Type for multipart
            },
            responseType: 'stream' // Important: handle the response as a stream
        });

        console.log(`[gateway]: Received response from AI service: ${aiResponse.status}`);

        res.writeHead(aiResponse.status, aiResponse.headers as http.OutgoingHttpHeaders);
        aiResponse.data.pipe(res);

    } catch (error) {
        console.error('[AI Service Request Error]:', error);
        if (axios.isAxiosError(error)) {
            if (error.response) {
                console.error('Error response from AI service:', error.response.status, error.response.data);
                const errorMessage = error.response.data?.detail || error.response.data || 'Error detail not available';
                res.status(error.response.status)
                   .set(error.response.headers as http.OutgoingHttpHeaders)
                   .json({ message: "Error from AI service", detail: errorMessage }); // Send simplified JSON
            } else {
                res.status(502).json({ message: 'Error connecting to AI service', error: error.message });
            }
        } else {
            next(error);
        }
    }
});

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
  console.log(`[handler]: /api/transform -> ${aiServiceUrl}/transform (Manual Handling)`);
});
