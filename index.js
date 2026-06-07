require('dotenv').config();
const path = require('path');
const Fastify = require('fastify');
const MongoStore = require('connect-mongo');
const connectDB = require('./config/db');

const fastify = Fastify({ logger: process.env.NODE_ENV !== 'production' });

(async () => {
  await connectDB();

  // ── Plugins ──────────────────────────────────────────────────
  await fastify.register(require('@fastify/cors'), {
    origin: true,
    credentials: true,
  });

  await fastify.register(require('@fastify/cookie'));

  await fastify.register(require('@fastify/session'), {
    secret: process.env.SESSION_SECRET || 'mxdnight_super_secret_change_this',
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
    saveUninitialized: false,
  });

  await fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, '..', 'public'),
    prefix: '/',
  });

  // ── Routes ───────────────────────────────────────────────────
  await fastify.register(require('./routes/auth'), { prefix: '/auth' });
  await fastify.register(require('./routes/guilds'), { prefix: '/api/guilds' });
  await fastify.register(require('./routes/api'), { prefix: '/api/guilds' });

  // Serve dashboard.html for any non-API route
  fastify.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/auth')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.sendFile('dashboard.html');
  });

  // ── Start ────────────────────────────────────────────────────
  const PORT = parseInt(process.env.PORT) || 3001;
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[Server] MXDNIGHT running on http://localhost:${PORT}`);
})();
