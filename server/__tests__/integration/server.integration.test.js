import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { neon } from '@neondatabase/serverless';
import request from 'supertest';
import { configDotenv } from 'dotenv';
import express from 'express';
import cors from 'cors';
configDotenv();
const pgsql = neon(`${process.env.DATABASE_URL}`);

const TEST_USER_ID = 'integration_test_user_001';

jest.unstable_mockModule('../../configs/db.js', () => ({ default: pgsql }));

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

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  auth: (req, res, next) => {
    req.plan = 'free';
    req.free_usage = 0;
    next();
  },
}));

jest.unstable_mockModule('@clerk/express', () => ({
  clerkMiddleware: () => (req, res, next) => next(),
  requireAuth: () => (req, res, next) => next(),
  clerkClient: {
    users: {
      getUser: jest.fn().mockResolvedValue({
        id: TEST_USER_ID,
        privateMetaData: { free_usage: 0 },
      }),
      updateUserMetadata: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.unstable_mockModule('../../configs/gemini.js', () => ({
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

jest.unstable_mockModule('axios', () => ({
  default: {
    post: jest.fn().mockResolvedValue({
      data: Buffer.from('fake-image-binary-data'),
    }),
  },
}));

const setUp = async () => {
  const app = express();
  app.use(express.json());
  app.use(cors());

  app.use((req, res, next) => {
    req.auth = () => ({
      userId: TEST_USER_ID,
      has: jest.fn().mockResolvedValue(false),
    });
    req.plan = 'free';
    req.free_usage = 0;
    next();
  });

  const { default: aiRouter } = await import('../../routes/aiRoutes.js');
  const { default: userRouter } = await import('../../routes/userRoutes.js');

  app.use('/api/ai', aiRouter);
  app.use('/api/user', userRouter);

  return app;
};

const cleanUpTestUser = async () => {
  await pgsql`DELETE FROM creations WHERE user_id = ${TEST_USER_ID}`;
};

const seedCreation = async (overRide = {}) => {
  const [creation] =
    await pgsql`INSERT INTO creations (user_id, prompt, content, type, publish, likes)
    VALUES (
      ${TEST_USER_ID},
      ${overRide.prompt ?? 'test prompt'},
      ${overRide.content ?? 'https://cloudinary.com/mock-image.png'},
      ${overRide.type ?? 'image'},
      ${overRide.publish ?? false},
      ${overRide.likes ?? []}
    )
    RETURNING *
  `;
  return creation;
};

describe('Integration Test', () => {
  let app;
  beforeAll(async () => {
    app = await setUp();
  });

  afterEach(async () => {
    await cleanUpTestUser();
    jest.clearAllMocks();
  });
  describe('DATABASE CONNECTION', () => {
    it('Should connect to db', async () => {
      const res = await pgsql`SELECT 1 as connected`;
      expect(res[0].connected).toBe(1);
    });
    it('should have a creation table', async () => {
      const res = await request(app).post('/api/ai/generate-article').send({
        prompt: 'Write about integration test',
        length: 'short',
        publish: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const [saved] =
        await pgsql`SELECT * FROM creations WHERE user_id = ${TEST_USER_ID} AND type = 'article';`;
      expect(saved).toBeDefined();
      expect(saved.prompt).toBe('Write about integration test');
      expect(saved.user_id).toBe(TEST_USER_ID);
    });

    it('should persist article with publish = true to real db', async () => {
      const res = await request(app).post('/api/ai/generate-article').send({
        prompt: 'Published article test',
        length: 'short',
        publish: true,
      });
      await pgsql`SELECT * FROM creations WHERE user_id = ${TEST_USER_ID} AND type = 'article';`;
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
  describe('POST /api/ai/generate-image', () => {
    it('should generate image and persist it to real db', async () => {
      process.env.CLIPDROP_API_KEY = 'mock_api_key';
      const res = await request(app)
        .post('/api/ai/generate-image')
        .send({ prompt: 'A beautiful sunset over the ocean', publish: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content).toBe('https://cloudinary.com/mock-image.png');

      const [saved] =
        await pgsql`SELECT * FROM creations WHERE user_id = ${TEST_USER_ID} and type = 'image';`;
      expect(saved).toBeDefined();
      expect(saved.content).toBe('https://cloudinary.com/mock-image.png');
      expect(saved.prompt).toBe('A beautiful sunset over the ocean');
    });

    it('should return 400 if prompt is missing', async () => {
      const res = await request(app)
        .post('/api/ai/generate-image')
        .send({ publish: false });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
  describe('GET /api/user/get-user-creations', () => {
    it('should return empty array when user has no connections', async () => {
      const res = await request(app).get('/api/user/get-user-creations');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.creations).toEqual([]);
    });
    it('should return all creations when for the user when the user from real db', async () => {
      await seedCreation({ type: 'image', prompt: 'image prompt' });
      await seedCreation({ type: 'article', prompt: 'article prompt' });
      const res = await request(app).get('/api/user/get-user-creations');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.creations.length).toBe(2);
    });
  });

  describe('POST /api/user/toggle-like-creations', () => {
    it('should like a creation and persist to real DB', async () => {
      const creation = await seedCreation();
      const res = await request(app)
        .post('/api/user/toggle-like-creations')
        .send({ id: creation.id });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const [updated] =
        await pgsql`SELECT * FROM creations WHERE id = ${creation.id}`;
      expect(updated.likes).toContain(TEST_USER_ID);
    });
    it('should unlike a creation if already liked in real DB', async () => {
      const creation = await seedCreation({ likes: [TEST_USER_ID] });

      const res = await request(app)
        .post('/api/user/toggle-like-creations')
        .send({ id: creation.id });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const [updated] =
        await pgsql`SELECT * FROM creations WHERE id = ${creation.id};`;
      expect(updated.likes).not.toContain(TEST_USER_ID);
    });
    it('should return 400 if creation does not exist in DB', async () => {
      const res = await request(app)
        .post('/api/user/toggle-like-creations')
        .send({ id: 99999 });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/no creation exist/i);
    });
  });

  describe('POST /api/ai/generate-blog', () => {
    it('should generate blog title and persist to real db', async () => {
      const res = await request(app)
        .post('/api/ai/generate-blog')
        .send({ prompt: 'Write a blog title about AI trends' });
      console.log('blog-title-body', res.body);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content).toBeDefined();

      const [saved] =
        await pgsql`SELECT * FROM creations WHERE user_id = ${TEST_USER_ID} AND type = 'blog-title';`;
      expect(saved).toBeDefined();
      expect(saved.prompt).toBe('Write a blog title about AI trends');
      expect(saved.user_id).toBe(TEST_USER_ID);
    });

    it('should return 400 if prompt is missing', async () => {
      const res = await request(app).post('/api/ai/generate-blog').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/prompt/i);
    });
  });
  describe('POST /api/ai/remove-image-background', () => {
    it('should remove background and persist to real DB', async () => {
      const res = await request(app)
        .post('/api/ai/remove-image-background')
        .attach('image', Buffer.from('mock image content'), {
          filename: 'test.png',
          contentType: 'image/png',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content).toBeDefined();

      const [saved] =
        await pgsql`SELECT * FROM creations WHERE user_id = ${TEST_USER_ID} AND type = 'image';`;
      expect(saved).toBeDefined();
      expect(saved.user_id).toBe(TEST_USER_ID);
    });
    it('should return 400 if no image is uploaded', async () => {
      const res = await request(app)
        .post('/api/ai/remove-image-background')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/image/i);
    });
  });
  describe('POST /api/ai/remove-image-object', () => {
    it('should remove object and persist to real db', async () => {
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

      const [saved] =
        await pgsql`SELECT * FROM creations WHERE user_id = ${TEST_USER_ID} AND type = 'image';`;
      expect(saved).toBeDefined();
      expect(saved.prompt).toMatch(/car/i);
    });
    it('should return 400 if image is missing', async () => {
      const res = await request(app)
        .post('/api/ai/remove-image-object')
        .send({ object: 'car' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
    it('should return 400 if object is missing', async () => {
      const res = await request(app)
        .post('/api/ai/remove-image-object')
        .attach('image', Buffer.from('mock image content'), {
          filename: 'test.png',
          contentType: 'image/png',
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/ai/resume-review', () => {
    it('should review resume and persist to real db', async () => {
      const res = await request(app)
        .post('/api/ai/resume-review')
        .attach('resume', Buffer.from('mock pdf content'), {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content).toBeDefined();

      const [saved] =
        await pgsql`SELECT * FROM creations WHERE user_id = ${TEST_USER_ID} AND type = 'resume-review';`;
      expect(saved).toBeDefined();
      expect(saved.user_id).toBe(TEST_USER_ID);
    });
    it('should return error if resume exceeds 5mb', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
      const res = await request(app)
        .post('/api/ai/resume-review')
        .attach('resume', largeBuffer, {
          filename: 'large-resume-pdf',
          contentType: 'application/pdf',
        });
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/5mb/i);
    });
  });
});
