// server.js - CẬP NHẬT ĐỂ XỬ LÝ CORS ĐÚNG CÁCH
import express from 'express';
import { CONNECT_DB, CLOSE_DB } from './config/mongodb.js';
import AsyncExitHook from 'async-exit-hook';
import { env } from './config/environment.js';
import APIs_V1 from './routes/index.js';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';

const allowOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.FRONTEND_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
];

const app = express();

// ==================== HELMET CONFIG ====================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(cookieParser());

// ==================== CORS CONFIGURATION ====================
// Cách 1: Dùng cors middleware đơn giản nhất
app.use(cors({
  origin: function (origin, callback) {
    // Cho phép requests không có origin (server-to-server, curl)
    if (!origin) return callback(null, true);
    
    // Cho phép tất cả các origins trong danh sách
    if (allowOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Cho phép tất cả subdomains của latelia.com
    if (origin.endsWith('.latelia.com')) {
      return callback(null, true);
    }
    
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Client',
    'X-Strategy',
    'X-Client-Version',
    'X-Client-Domain',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['Content-Length', 'Authorization', 'X-Total-Count'],
  maxAge: 86400, // Cache preflight 24h
  optionsSuccessStatus: 204
}));

// ==================== LOGGING MIDDLEWARE ====================
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const method = req.method;
  const path = req.path;
  const memoryUsage = process.memoryUsage();
  const usedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
  const totalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100;
  
  if (usedMB > 300) { // Nếu sử dụng > 300MB
    console.warn(`⚠️ Memory high: ${usedMB}MB/${totalMB}MB`);
  }
  console.log(`🌐 ${method} ${path} from ${origin || 'no-origin'}`);
  
  // Log headers cho OPTIONS requests để debug
  if (method === 'OPTIONS') {
    console.log('🛫 Preflight request headers:', {
      'Access-Control-Request-Method': req.headers['access-control-request-method'],
      'Access-Control-Request-Headers': req.headers['access-control-request-headers'],
      Origin: req.headers.origin
    });
  }
  
  next();
});

// ==================== XỬ LÝ PREFLIGHT THEO CÁCH KHÁC ====================
// Middleware xử lý preflight riêng
app.use((req, res, next) => {
  // Nếu là OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    
    // Kiểm tra origin
    if (origin && allowOrigins.some(allowed => 
      origin === allowed || origin.endsWith('.latelia.com')
    )) {
      // Set CORS headers
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.header('Access-Control-Allow-Headers', 
        req.headers['access-control-request-headers'] || 
        'Content-Type, Authorization, X-Requested-With, X-Client, X-Strategy'
      );
      res.header('Access-Control-Max-Age', '86400');
      res.header('Vary', 'Origin');
    }
    
    return res.status(204).end(); // No content
  }
  
  next();
});

// ==================== BODY PARSER ====================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

// ==================== ROUTES ====================
app.use('/v1', APIs_V1);

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV || 'development',
    cors: {
      allowedOrigins: allowOrigins,
      currentOrigin: req.headers.origin
    }
  });
});

// ==================== CORS TEST ENDPOINT ====================
app.get('/cors-test', (req, res) => {
  const origin = req.headers.origin;
  
  if (origin && allowOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  res.json({
    success: true,
    message: 'CORS test successful',
    origin: origin,
    timestamp: new Date().toISOString(),
    headers: {
      origin: req.headers.origin,
      'x-client': req.headers['x-client'],
      'x-strategy': req.headers['x-strategy']
    }
  });
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error('[Error Middleware]', err.message);
  
  // Thêm CORS headers ngay cả khi error
  const origin = req.headers.origin;
  if (origin && allowOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  const origin = req.headers.origin;
  
  if (origin && allowOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

const START_SERVER = () => {
  const server = app.listen(env.APP_PORT || 10000, '0.0.0.0', () => {
  });

  server.timeout = 300000;
  
  AsyncExitHook(() => {
    console.log('Disconnecting from Database');
    CLOSE_DB();
    console.log('Disconnected from Database');
  });
};

(async () => {
  try {
    console.log('Connecting to Database...');
    await CONNECT_DB();
    console.log('✅ Connected to Database');
    START_SERVER();
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
})();
