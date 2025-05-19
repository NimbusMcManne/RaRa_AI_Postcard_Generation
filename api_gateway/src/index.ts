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

    const {
        period_id,
        category_id,
        local_style_image_id,
        processing_mode = 'local',
        ai_model_choice = 'local_vgg',
        content_weight,
        style_weight,
        tv_weight,
        num_steps,
        learning_rate,
        saturation_enabled,
        saturation_factor,
        clahe_enabled,
        clahe_clip_limit,
        usm_enabled,
        usm_amount,
        style_blur
    } = req.body;

    if (local_style_image_id) {
      console.log(`[gateway]: Received local_style_image_id: ${local_style_image_id}, mode: ${processing_mode}, model: ${ai_model_choice}`);
    } else {
      console.log(`[gateway]: Received period_id: ${period_id}, category_id: ${category_id}, mode: ${processing_mode}, model: ${ai_model_choice}`);
    }

    if (!local_style_image_id && (!period_id || !category_id)) {
        return res.status(400).json({ message: 'Missing period_id/category_id or local_style_image_id' });
    }

    const formData = new FormData();
    formData.append('content_image', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
    });

    if (local_style_image_id) {
        try {
            const listUrl = `${dataProcessingUrl}/api/local-test-styles`;
            console.log(`[gateway] Fetching local style list from ${listUrl} to find ID ${local_style_image_id}`);
            const listResponse = await axios.get(listUrl, { timeout: 10000 });
            const styles = listResponse.data.styles;
            const selectedStyle = styles.find((s: any) => s.id === local_style_image_id);

            if (!selectedStyle || !selectedStyle.imageDataUrl) {
                throw new Error(`Local style image data not found for ID: ${local_style_image_id}`);
            }

            const base64Prefix = `data:${selectedStyle.imageDataUrl.split(';')[0].split(':')[1]};base64,`;
            const base64Data = selectedStyle.imageDataUrl.replace(base64Prefix, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');

            formData.append('local_style_image_file', imageBuffer, {
                 filename: local_style_image_id,
                 contentType: selectedStyle.imageDataUrl.split(';')[0].split(':')[1] || 'image/jpeg'
            });
            console.log(`[gateway] Appended local style file ${local_style_image_id} to FormData`);

        } catch (fetchError) {
             console.error(`[gateway] Error fetching/processing local style ${local_style_image_id}:`, fetchError);
             return next(new Error(`Failed to retrieve local style image: ${local_style_image_id}`));
        }
    } else {
        formData.append('period_id', period_id);
        formData.append('category_id', category_id);
    }

    formData.append('processing_mode', processing_mode);
    formData.append('ai_model_choice', ai_model_choice);

    if (processing_mode === 'local') {
        if (content_weight !== undefined) formData.append('content_weight', content_weight);
        if (style_weight !== undefined) formData.append('style_weight', style_weight);
        if (tv_weight !== undefined) formData.append('tv_weight', tv_weight);
        if (num_steps !== undefined) formData.append('num_steps', num_steps);
        if (learning_rate !== undefined) formData.append('learning_rate', learning_rate);

        if (saturation_enabled !== undefined) formData.append('saturation_enabled', saturation_enabled);
        if (saturation_factor !== undefined) formData.append('saturation_factor', saturation_factor);
        if (clahe_enabled !== undefined) formData.append('clahe_enabled', clahe_enabled);
        if (clahe_clip_limit !== undefined) formData.append('clahe_clip_limit', clahe_clip_limit);
        if (usm_enabled !== undefined) formData.append('usm_enabled', usm_enabled);
        if (usm_amount !== undefined) formData.append('usm_amount', usm_amount);
    } else if (processing_mode === 'cloud') {
        if (style_weight !== undefined) formData.append('style_weight', style_weight);
        if (content_weight !== undefined) formData.append('content_weight', content_weight);
        if (style_blur !== undefined) formData.append('style_blur', style_blur);
    }

    const targetUrl = `${aiServiceUrl}/transform`;

    try {
        console.log(`[gateway]: Forwarding request to AI service at ${targetUrl}`);
        const aiResponse = await axios.post(targetUrl, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            responseType: 'stream' 
        });

        console.log(`[gateway]: Received response from AI service: ${aiResponse.status}`);

        res.writeHead(aiResponse.status, aiResponse.headers as http.OutgoingHttpHeaders);
        aiResponse.data.pipe(res);

    } catch (error) {
        console.error('[AI Service Request Error]');
        if (axios.isAxiosError(error)) {
            const method = error.config?.method?.toUpperCase();
            const url = error.config?.url;
            if (error.response) {
                const status = error.response.status;
                let detail = 'Unknown error detail';
                try {
                    const chunks: Buffer[] = [];
                    for await (const chunk of error.response.data) {
                        chunks.push(Buffer.from(chunk));
                    }
                    const errorBody = Buffer.concat(chunks).toString('utf-8');
                    try {
                        const errorJson = JSON.parse(errorBody);
                        detail = errorJson.detail || errorBody;
                    } catch (parseError) {
                        detail = errorBody;
                    }
                } catch (e) { detail = 'Could not parse error response.'; }
                console.error(`Error from AI service: Status ${status} on ${method} ${url}`);
                console.error(`Detail: ${detail}`);
                if (!res.headersSent) {
                  res.status(status).json({ message: "Error from AI service", detail: detail });
                }
            } else if (error.request) {
                console.error(`Network error connecting to AI service: ${error.message} on ${method} ${url}`);
                 if (!res.headersSent) {
                    res.status(502).json({ message: 'Error connecting to AI service', detail: error.message });
                 }
            } else {
                 console.error(`Axios setup error: ${error.message}`);
                 if (!res.headersSent) {
                    next(error);
                 }
            }
        } else {
            console.error(`Non-axios error during AI service call: ${error}`);
             if (!res.headersSent) {
                next(error);
             }
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
  console.log(`[proxy]: /api/result/:processId -> ${aiServiceUrl}/result/:processId`);
  console.log(`[proxy]: /api/local-test-styles -> ${dataProcessingUrl}/api/local-test-styles`);
});

app.use('/api/local-test-styles', createProxyMiddleware({
    ...proxyOptionsBase,
    target: dataProcessingUrl,
    pathRewrite: { '^/': '/api/local-test-styles' },
    on: {
        proxyReq: (proxyReq, _req, _res) => {
            console.log(`[proxy]: LOCAL STYLES LIST Request forwarded: ${proxyReq.method} ${proxyReq.path}`);
        },
        proxyRes: (proxyRes, _req, res) => {
            console.log(`[proxy]: LOCAL STYLES LIST Response received: ${proxyRes.statusCode}`);
            Object.keys(proxyRes.headers).forEach((key) => {
                res.setHeader(key, proxyRes.headers[key] as string | string[]);
            });
            res.writeHead(proxyRes.statusCode ?? 500);
            proxyRes.pipe(res);
        },
        error: (err, _req, res) => {
            console.error('[Local Styles List Proxy Error]:', err);
            if (res instanceof http.ServerResponse && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
            }
            if (res instanceof http.ServerResponse) {
              res.end(JSON.stringify({ message: 'Proxy error connecting to Data Processing service for local styles list', error: err.message }));
            }
        }
    }
}));
