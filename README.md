# Digar Postcard AI Transformation Project

## Project Overview

This project implements an AI-powered image transformation system that bridges historical postcards with modern photography. Users can upload images and apply historical postcard styles based on period and category selections from the Digar archival postcard collection.

The system consists of four main components:
1. **Data Processing Service** - Handles postcard metadata, period classification, and categorization
2. **AI Service** - Implements neural style transfer for image transformation
3. **Web Interface** - Provides user-facing UI for image uploads and style selection
4. **API Gateway** - Coordinates communication between services

## System Requirements

- **Node.js** (v18+ recommended) and npm for backend services
- **Python** (3.8+) for AI service
- **Docker** and docker-compose (optional, for containerized development)
- GPU for faster processing and shorter wait times (only for local VGG implementation)

## Installation & Setup

The project uses a multi-service architecture. Follow these steps to set up the complete environment.

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/RaRa_AI_Postcard_Generation.git
cd RaRa_AI_Postcard_Generation
```

### 2. Data Processing Service Setup

```bash
cd data_processing

npm install

npm run build

npm run dev
```

The data processing service runs on port 3001 by default.

### 3. API Gateway Setup

```bash
cd ../api_gateway

npm install

npm run build

npm run dev
```

The API gateway runs on port 3002 by default.

### 4. AI Service Setup

```bash
cd ../ai_service

python3 -m venv venv
source venv/bin/activate  

pip install -r requirements.txt

uvicorn src.api.app:app --host 0.0.0.0 --port 8000 --reload
```

The AI service runs on port 8000 by default.

### 5. Web Interface Setup

```bash
cd ../web_interface

npm install

npm run dev
```

The web interface runs on port 5173 by default and can be accessed at http://localhost:5173.

## Configuration

### Environment Variables

Each service has its own `.env` file for configuration:

#### Data Processing Service

Create `data_processing/.env`:
```
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3002,http://localhost:5173
```

#### API Gateway

Create `api_gateway/.env`:
```
PORT=3002
NODE_ENV=development
DATA_PROCESSING_URL=http://localhost:3001
AI_SERVICE_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:5173
```

#### Web Interface (Vite Configuration)

If needed, modify `web_interface/vite.config.ts` to adjust proxy settings:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3002',
      changeOrigin: true,
    }
  }
}
```

#### AI Service

Create `ai_service/.env` (optional):
```
# Optional environment variables
CUDA_VISIBLE_DEVICES=0  # Control which GPU to use
```

Core AI parameters are configured in `ai_service/config/config.yaml`.

### Distributed Deployment Configuration

When deploying services on different machines, update the following:

1. **API Gateway** - Update the `.env` file with the correct URLs:
   ```
   DATA_PROCESSING_URL=http://data-processing-server:3001
   AI_SERVICE_URL=http://ai-service-server:8000
   ```

2. **Data Processing & API Gateway** - Update CORS settings in their respective `.env` files to include all service origins.

3. **Web Interface** - Update the Vite proxy configuration to point to the API Gateway server:
   ```typescript
   server: {
     proxy: {
       '/api': {
         target: 'http://api-gateway-server:3002',
         changeOrigin: true,
       }
     }
   }
   ```

## Using the Application

1. Start all four services as described above
2. Open http://localhost:5173 in your browser
3. Upload a content image
4. Select a historical period and category
5. Click "Transform Image"
6. Wait for the transformation to complete
7. View and download the result

## Additional Features

### Fetching Initial Data

If you need to fetch and process the initial postcard data from the Digar archive:

```bash
cd data_processing
npm run fetch:initial
```

This will fetch, transform, and categorize the postcard data, making it available for the application.

### Manual AI Testing

To manually test the AI transformation without the web interface:

```bash
cd ai_service
source venv/bin/activate
python tests/manual_test.py --period_id <period> --category_id <category> path/to/content.jpg path/to/output.jpg
```

## Troubleshooting

### Common Issues

#### Port Conflicts

If you encounter "address already in use" errors:
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solution:**
1. Find the process using the port:
   ```bash
   # Linux/macOS
   sudo lsof -i :3001
   # Windows
   netstat -ano | findstr 3001
   ```
2. Kill the process:
   ```bash
   # Linux/macOS
   kill -9 <PID>
   # Windows
   taskkill /F /PID <PID>
   ```

#### Python Virtual Environment Issues

**Issue:** Missing `python3-venv` module

**Solution:**
```bash
sudo apt install python3.10-venv 
rm -rf venv                     
python3 -m venv venv           
```

**Issue:** IDE doesn't recognize Python packages

**Solution:** Configure your IDE to use the virtual environment's Python interpreter:
- VS Code/Cursor: Ctrl+Shift+P → "Python: Select Interpreter" → Select the one in `ai_service/venv/bin/python`

#### Network Issues

**Issue:** Services can't communicate

**Solution:**
- Check that all services are running
- Verify `.env` files contain correct URLs
- Ensure CORS settings include all service origins
- Check firewall settings if services are on different machines

#### AI Service Issues

**Issue:** Out of memory errors during image transformation

**Solution:**
- Reduce image size by modifying `max_size` in `ai_service/config/config.yaml`
- Ensure sufficient system memory is available
- If running on CPU, reduce batch size

#### NodeJS Dependency Issues

**Solution:**
```bash
rm -rf node_modules
npm cache clean --force
npm install
```

### Log Locations

- **Data Processing & API Gateway:** Console output (when running with `npm run dev`)
- **AI Service:** Console output (when running with `uvicorn`)
- **Web Interface:** Browser console and Vite terminal output

## License and Attribution

This project was developed as part of a bachelor thesis to demonstrate AI-assisted image transformation techniques using historical postcard styles from the Digar archive.
