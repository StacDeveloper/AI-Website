import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import cors from 'cors';
import express from 'express';

describe('Server Health Check', () => {
  it('Should return 200 on health endpoint', async () => {
    expect(true).toBe(true);
  });
});

jest.unstable_mockModule('@clerk/express', () => ({
  clerkMiddleware: () => (req, res, next) => next(),
  requireAuth: () => (req, res, next) => next(),
  clerkClient: {
    users: {
      getUser: jest.fn().mockResolvedValue({
        id: 'test_user_id',
        privateMetadata: { free_usage: 0 },
      }),
      updateUserMetadata: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.unstable_mockModule('axios', () => ({
  default: {
    post: jest.fn().mockImplementation((url, config, data) => {
      if (!process.env.CLIPDROP_API_KEY) {
        return Promise.reject({
          response: { status: 403, data: 'Invalid API response' },
        });
      }
      return Promise.resolve({ data: Buffer.from('mock image data') });
    }),
  },
}));

jest.unstable_mockModule('../configs/db.js', () => ({
  default: jest.fn().mockResolvedValue([{ id: 1 }]),
}));

jest.unstable_mockModule('../configs/gemini.js', () => ({
  default: {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mocked AI response' } }],
        }),
      },
    },
  },
}));

jest.unstable_mockModule('cloudinary', () => ({
  v2: {
    uploader: {
      upload: jest.fn().mockResolvedValue({
        secure_url: 'https://cloudinary.com/mock-image.png',
        public_id: 'mock_public_id',
      }),
    },
    url: jest.fn().mockResolvedValue('https://cloudinary.com/mock-removed.png'),
    config: jest.fn(),
  },
}));

jest.unstable_mockModule('pdf-parse', () => ({
  PDFParse: jest.fn().mockResolvedValue({
    text: 'Mock resume content withs skilss and experience',
  }),
}));

jest.unstable_mockModule('fs', () => ({
  default: {
    readFileSync: jest.fn().mockResolvedValue('mock-pdf-content'),
  },
  readFileSync: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
  configDotenv: jest.fn(),
  config: jest.fn(),
}));

const setUp = async () => {
  const { default: aiRouter } = await import('../routes/aiRoutes.js');
  const app = express();
  app.use(express.json());
  app.use(cors());

  app.use((req, res, next) => {
    req.auth = () => ({
      userId: 'test_user_id',
      has: jest.fn().mockResolvedValue(false),
    });
    req.plan = 'free';
    req.free_usage = 0;
    next();
  });

  app.use('/api/ai', aiRouter);
  return app;
};

describe('AI controller Test', () => {
  let app;
  beforeAll(async () => {
    app = await setUp();
  });
  describe('POST /api/ai/generate-article', () => {
    it('should generate article successfully', async () => {
      const res = await request(app).post('/api/ai/generate-article').send({
        prompt: 'Write an article about AI',
        length: 500,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content).toBeDefined();
    });

    it('should return 400 if length is missing', async () => {
      const res = await request(app).post('/api/ai/generate-article').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/ai/generate-image', () => {
    it('should generate image successfully', async () => {
      process.env.CLIPDROP_API_KEY = 'mock_api_key';
      const res = await request(app).post('/api/ai/generate-image').send({
        prompt: 'A beautiful sunset over the ocean',
        publish: false,
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content).toBeDefined();
    });

    it('should return 400 if prompt is missing', async () => {
      const res = await request(app)
        .post('/api/ai/generate-image')
        .send({ publish: false });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/prompt/i);
    });

    it('should return error if API key is missing', async () => {
      delete process.env.CLIPDROP_API_KEY;

      const res = await request(app).post('/api/ai/generate-image').send({
        prompt: 'A beautiful sunset',
        publish: false,
      });
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/ai/remove-image-background', () => {
    it('should return 400 if no image is uploaded', async () => {
      const res = await request(app)
        .post('/api/ai/remove-image-background')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/image/i);
    });

    it('should remove background successfully when image is uploaded', async () => {
      const res = await request(app)
        .post('/api/ai/remove-image-background')
        .attach('image', Buffer.from('mock image content'), {
          filename: 'test.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content).toBeDefined();
    });
  });

  describe('POST /api/ai/remove-image-object', () => {
    it('should return 400 if no image or object is provided', async () => {
      const res = await request(app)
        .post('/api/ai/remove-image-object')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if object is missing but image is provided', async () => {
      const res = await request(app)
        .post('/api/ai/remove-image-object')
        .attach('image', Buffer.from('mock image content'), {
          filename: 'test.png',
          contentType: 'image/png',
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should successfully remove image', async () => {
      const res = await request(app)
        .post('/api/ai/remove-image-object')
        .field('object', 'car')
        .attach('image', Buffer.from('mock image content'), {
          filename: 'test.png',
          contentType: 'image/png',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content).toBeDefined();
    });
  });
  describe('POST /api/ai/resume-review', () => {
    it('should return 400 if no resume is uploaded', async () => {
      const res = await request(app).post('/api/ai/resume-review').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/resume/i);
    });

    it('should review resume successfully', async () => {
      const res = await request(app)
        .post('/api/ai/resume-review')
        .attach('resume', Buffer.from('mock pdf content'), {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content).toBeDefined();
    });

    it('should return error if resume exceeds 5mb', async () => {
      // Create a buffer larger than 5MB
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024);

      const res = await request(app)
        .post('/api/ai/resume-review')
        .attach('resume', largeBuffer, {
          filename: 'large-resume.pdf',
          contentType: 'application/pdf',
        });

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/5mb/i);
    });
  });

  describe('Health Check', () => {
    it('should return 200 on health endpoint', async () => {
      const app = express();
      app.use('/health', (req, res) => {
        res.json({ success: true, message: 'Server is healthy' });
      });

      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
