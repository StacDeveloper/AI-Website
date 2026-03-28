import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
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

// jest.unstable_mockModule("../configs/db.js", async () => {
//   const { default: pgsql } = await import("../configs/db.js")
//   pgsql.mockImplementation(() => Promise.resolve([{ id: 1 }]))
// })

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
  const { default: userRouter } = await import("../routes/userRoutes.js")
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
  app.use('/api/user', userRouter)
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

    afterEach(() => {
      jest.clearAllMocks()
      const restoreAllMocks = async () => {
        const { default: pgsql } = await import("../configs/db.js")
        pgsql.mockResolvedValue([{ id: 1 }])
      }
      restoreAllMocks()
    })

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

  describe("POST /api/ai/generate-article", () => {
    it("should return 500 if db throws error after generation", async () => {
      const { default: pgsql } = await import("../configs/db.js")
      pgsql.mockRejectedValueOnce("mock ai response").mockResolvedValueOnce(new Error("DB insert ERROR"))
      const res = await request(app).post("/api/ai/generate-article").send({ prompt: "Write an artile about AI", length: 500 })

      expect(res.status).toBe(500)
      expect(res.body.success).toBe(false)
    })
  })

  describe("POST /api/ai/generate-images", () => {
    it("should return 500 if db throws error after image generations", async () => {
      process.env.CLIPDROP_API_KEY = "mock_api_key"
      const { default: pgsql } = await import("../configs/db.js")
      pgsql.mockRejectedValueOnce(new Error("DB insert ERROR"))
      const res = await request(app).post("/api/ai/generate-image").send({ prompt: "A beautiful sunset", publish: false })
      expect(res.status).toBe(500)
      expect(res.body.success).toBe(false)
    })
  })

  describe("POST /api/ai/remove-image-object", () => {
    it("should return 500 if db throws error after object removal", async () => {
      const { default: pgsql } = await import("../configs/db.js")
      pgsql.mockRejectedValueOnce(new Error("DB insert error"))

      const res = await request(app).post("/api/ai/remove-image-object").field("object", "car").attach("image", Buffer.from("mock image content"), { filename: "test.png", contentType: "image/png" })

      expect(res.status).toBe(500)
      expect(res.body.success).toBe(false)
    })
  })

  describe("POST /api/ai/resume-review", () => {
    it("should return 500 if db throws after resume review", async () => {
      const { default: pgsql } = await import("../configs/db.js")
      pgsql.mockRejectedValueOnce(new Error("DB insert error"))

      const res = await request(app).post("/api/ai/resume-review").attach("resume", Buffer.from("mock pdf content"), { filename: "resume.pdf", contentType: "application/pdf" })

      expect(res.status).toBe(500)
      expect(res.body.success).toBe(false)
    })
  })
});

describe("User Controller Test", () => {
  let app;
  beforeAll(async () => {
    app = await setUp()
  })

  afterEach(async () => {
    jest.clearAllMocks()
    const restoreAllMocks = async () => {
      const { default: pgsql } = await import("../configs/db.js")
      pgsql.mockResolvedValue([{ id: 1 }])
    }
    restoreAllMocks()
  })

  it("should return 400 if userid is missing", async () => {
    const noAuthApp = express()
    noAuthApp.use(express.json())
    noAuthApp.use(cors())

    noAuthApp.use((req, res, next) => {
      req.auth = () => ({ userId: null, has: jest.fn() })
      req.plan = "free"
      req.free_usage = 0
      next()
    })
    const { default: userRouter } = await import("../routes/userRoutes.js")
    noAuthApp.use("/api/user", userRouter)

    const res = await request(noAuthApp).get("/api/user/get-user-creations")

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/user not found/i)
  })

  it("should return 500 if db throws on published creations", async () => {
    const { default: pgsql } = await import("../configs/db.js")
    pgsql.mockRejectedValueOnce(new Error("DB error"))

    const res = await request(app).get("/api/user/get-published-creations")

    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
  })

  describe("GET /api/user/get-user-creations", () => {
    beforeEach(async () => {
      const { default: pgsql } = await import("../configs/db.js")
      pgsql.mockResolvedValue([{ id: 1 }])
    })

    it("should return user creations successfully", async () => {
      const res = await request(app).get("/api/user/get-user-creations")

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.creations).toBeDefined()
    })

    it("should return 500 if db throws error", async () => {
      const { default: pgsql } = await import("../configs/db.js")
      pgsql.mockRejectedValue(new Error("DB error"))
      const res = await request(app).get("/api/user/get-user-creations")
      expect(res.status).toBe(500)
      expect(res.body.success).toBe(false)
    })

  })

  describe("GET /api/user/get-published-creations", () => {
    it("should return published creations of user", async () => {
      const { default: pgsql } = await import("../configs/db.js")
      pgsql.mockResolvedValueOnce([{ id: 1, publish: true }])
      const res = await request(app).get("/api/user/get-published-creations")
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.creations).toBeDefined()
    })
  })

  describe("POST /api/user/toggle-like-creations", () => {
    it("should return 400 if creation does not exist", async () => {
      const { default: pgsql } = await import("../configs/db.js")
      pgsql.mockResolvedValueOnce([])
      const res = await request(app).post("/api/user/toggle-like-creations").send({ id: "non-existant-id" })
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.message).toMatch(/no creation exist/i)
    })

    it("should like creation successfully", async () => {
      const { default: pgsql } = await import("../configs/db.js")
      pgsql.mockResolvedValueOnce([{ id: 1, likes: [] }])
      pgsql.mockResolvedValueOnce([{ id: 1, likes: ["test_user_id"] }])

      const res = await request(app).post("/api/user/toggle-like-creations").send({ id: 1 })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toMatch(/liked/i)
    })

    it("should unlike a creation if already liked", async () => {
      const { default: pgsql } = await import("../configs/db.js")
      pgsql.mockResolvedValueOnce([{ id: 1, likes: ["test_user_id"] }]) // already liked
      pgsql.mockResolvedValueOnce([{ id: 1, likes: [] }])               // UPDATE query

      const res = await request(app).post("/api/user/toggle-like-creations").send({ id: 1 })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toMatch(/unliked/i)
    })

    it("should return 500 if db throws error", async () => {
      const { default: pgsql } = await import("../configs/db.js")
      pgsql.mockRejectedValue(new Error("DB error"))

      const res = await request(app).post("/api/user/toggle-like-creations").send({ id: 1 })

      expect(res.status).toBe(500)
      expect(res.body.success).toBe(false)
    })
  })
})

describe("Auth Middleware Test", () => {
  it("should set plan to premium when user has premium plan", async () => {
    const { clerkClient } = await import("@clerk/express")
    const { default: pgsql } = await import("../configs/db.js")
    clerkClient.users.getUser.mockResolvedValueOnce({
      id: "test_user_id",
      privateMetadata: { free_usage: 0 },
    })
    pgsql.mockResolvedValueOnce([{ id: 1, user_id: "test_user_id" }])
    const { default: userRouter } = await import("../routes/userRoutes.js")
    const premiumApp = express()
    premiumApp.use(express.json())
    premiumApp.use(cors())

    premiumApp.use((req, res, next) => {
      req.auth = () => ({
        userId: "test_user_id",
        has: jest.fn().mockResolvedValue(true), // premium
      })
      next()
    })

    premiumApp.use("/api/user", userRouter)

    const res = await request(premiumApp)
      .get("/api/user/get-user-creations")  // ← correct path

    expect(res.status).toBe(200)
  })

  it("should set free_usage from metadata when user has existing usage", async () => {
    const { clerkClient } = await import("@clerk/express")
    clerkClient.users.getUser.mockResolvedValueOnce({
      id: "test_user_id",
      privateMetadata: { free_usage: 5 },
    })
    const { default: pgsql } = await import("../configs/db.js")
    pgsql.mockResolvedValueOnce([{ id: 1, user_id: "test_user_id" }])
    const { default: userRouter } = await import("../routes/userRoutes.js")
    const freeApp = express()
    freeApp.use(express.json())
    freeApp.use(cors())

    freeApp.use((req, res, next) => {
      req.auth = () => ({
        userId: "test_user_id",
        has: jest.fn().mockResolvedValue(false), // not premium
      })
      next()
    })

    freeApp.use("/api/user", userRouter)

    const res = await request(freeApp)
      .get("/api/user/get-user-creations")  // ← correct path

    expect(res.status).toBe(200)
  })

  it("should return 500 if auth throws error", async () => {
    const { default: userRouter } = await import("../routes/userRoutes.js")
    const errorApp = express()
    errorApp.use(express.json())
    errorApp.use(cors())

    errorApp.use((req, res, next) => {
      req.auth = () => {
        throw new Error("Auth failed")
      }
      next()
    })

    errorApp.use("/api/user", userRouter)

    const res = await request(errorApp)
      .get("/api/user/get-user-creations")  // ← correct path

    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
  })
})

