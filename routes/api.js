const axios = require('axios');
const { requireGuildAccess, requireOwner, requireAuth } = require('./middleware');
const BeatBattle = require('../models/BeatBattle');
const Modlog = require('../models/Modlog');
const XP = require('../models/XP');
const Economy = require('../models/Economy');
const Giveaway = require('../models/Giveaway');
const Ticket = require('../models/Ticket');

const bot = (path, method = 'get', data = null) => {
  const url = `${process.env.BOT_API_URL}${path}`;
  const cfg = { headers: { 'x-api-key': process.env.BOT_API_KEY } };
  return method === 'get' ? axios.get(url, cfg)
    : method === 'delete' ? axios.delete(url, cfg)
    : axios.post(url, data, cfg);
};

// ── Beat Battles ────────────────────────────────────────────────────────────
async function battleRoutes(fastify) {
  fastify.get('/:guildId/battles', { preHandler: requireGuildAccess }, async (req) =>
    BeatBattle.find({ guildId: req.params.guildId }).sort({ createdAt: -1 }).limit(20));

  fastify.post('/:guildId/battles', { preHandler: requireGuildAccess }, async (req) => {
    const b = new BeatBattle({ guildId: req.params.guildId, ...req.body, createdBy: req.session.user.id });
    await b.save(); return b;
  });

  fastify.patch('/:guildId/battles/:id/advance', { preHandler: requireGuildAccess }, async (req, reply) => {
    const b = await BeatBattle.findById(req.params.id);
    if (!b) return reply.code(404).send({ error: 'Not found' });
    if (b.status === 'open') { b.status = 'voting'; }
    else if (b.status === 'voting') {
      b.status = 'ended'; b.endedAt = new Date();
      const tally = {};
      b.votes.forEach(v => { tally[v.votedFor] = (tally[v.votedFor] || 0) + 1; });
      const winnerId = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
      const ws = b.submissions.find(s => s.userId === winnerId);
      if (ws) b.winner = { userId: ws.userId, username: ws.username, trackName: ws.trackName };
    }
    await b.save(); return b;
  });

  fastify.delete('/:guildId/battles/:id/submissions/:userId', { preHandler: requireGuildAccess }, async (req) => {
    const b = await BeatBattle.findById(req.params.id);
    b.submissions = b.submissions.filter(s => s.userId !== req.params.userId);
    await b.save(); return b;
  });

  fastify.delete('/:guildId/battles/:id', { preHandler: requireGuildAccess }, async (req) => {
    await BeatBattle.findByIdAndDelete(req.params.id); return { ok: true };
  });
}

// ── Moderation ──────────────────────────────────────────────────────────────
async function modRoutes(fastify) {
  fastify.get('/:guildId/mod', { preHandler: requireGuildAccess }, async (req) => {
    const { action, userId, page = 1, limit = 20 } = req.query;
    const filter = { guildId: req.params.guildId };
    if (action) filter.action = action;
    if (userId) filter.userId = userId;
    const total = await Modlog.countDocuments(filter);
    const logs = await Modlog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(+limit);
    return { logs, total, page: +page, pages: Math.ceil(total / limit) };
  });

  fastify.post('/:guildId/mod', { preHandler: requireGuildAccess }, async (req) => {
    const { userId, username, action, reason, duration } = req.body;
    const { guildId } = req.params;
    try { await bot(`/mod/${guildId}`, 'post', { action, userId, reason, duration }); } catch {}
    const log = new Modlog({ guildId, userId, username, action, reason, moderatorId: req.session.user.id, moderatorName: req.session.user.globalName || req.session.user.username, duration: duration || null, expiresAt: duration ? new Date(Date.now() + duration * 60000) : null });
    await log.save(); return log;
  });

  fastify.patch('/:guildId/mod/:caseId/revoke', { preHandler: requireGuildAccess }, async (req, reply) => {
    const log = await Modlog.findOneAndUpdate({ guildId: req.params.guildId, caseId: +req.params.caseId }, { $set: { active: false } }, { new: true });
    if (!log) return reply.code(404).send({ error: 'Not found' });
    try { await bot(`/mod/${req.params.guildId}`, 'post', { action: log.action === 'ban' ? 'unban' : 'unmute', userId: log.userId, reason: 'Dashboard revoke' }); } catch {}
    return log;
  });

  fastify.delete('/:guildId/mod/:caseId', { preHandler: requireGuildAccess }, async (req) => {
    await Modlog.findOneAndDelete({ guildId: req.params.guildId, caseId: +req.params.caseId }); return { ok: true };
  });
}

// ── XP ──────────────────────────────────────────────────────────────────────
async function xpRoutes(fastify) {
  fastify.get('/:guildId/xp', { preHandler: requireGuildAccess }, async (req) => {
    const { page = 1, limit = 20 } = req.query;
    const total = await XP.countDocuments({ guildId: req.params.guildId });
    const users = await XP.find({ guildId: req.params.guildId }).sort({ xp: -1 }).skip((page - 1) * limit).limit(+limit);
    return { users, total };
  });

  fastify.patch('/:guildId/xp/:userId', { preHandler: requireGuildAccess }, async (req, reply) => {
    const user = await XP.findOneAndUpdate({ guildId: req.params.guildId, userId: req.params.userId }, { $set: { ...req.body, updatedAt: new Date() } }, { new: true });
    if (!user) return reply.code(404).send({ error: 'Not found' });
    return user;
  });

  fastify.delete('/:guildId/xp/:userId', { preHandler: requireGuildAccess }, async (req) => {
    await XP.findOneAndUpdate({ guildId: req.params.guildId, userId: req.params.userId }, { $set: { xp: 0, level: 0, totalMessages: 0 } }); return { ok: true };
  });
}

// ── Economy ─────────────────────────────────────────────────────────────────
async function economyRoutes(fastify) {
  fastify.get('/:guildId/economy', { preHandler: requireGuildAccess }, async (req) => {
    const { page = 1, limit = 20 } = req.query;
    const total = await Economy.countDocuments({ guildId: req.params.guildId });
    const users = await Economy.find({ guildId: req.params.guildId }).sort({ wallet: -1 }).skip((page - 1) * limit).limit(+limit).select('-transactions');
    return { users, total };
  });

  fastify.patch('/:guildId/economy/:userId', { preHandler: requireGuildAccess }, async (req, reply) => {
    const user = await Economy.findOne({ guildId: req.params.guildId, userId: req.params.userId });
    if (!user) return reply.code(404).send({ error: 'Not found' });
    const { wallet, bank, reason } = req.body;
    if (wallet !== undefined) user.wallet = wallet;
    if (bank !== undefined) user.bank = bank;
    user.transactions.push({ type: 'admin', amount: 0, description: reason || 'Admin adjustment' });
    user.updatedAt = new Date();
    await user.save(); return user;
  });

  fastify.delete('/:guildId/economy/:userId', { preHandler: requireGuildAccess }, async (req) => {
    await Economy.findOneAndUpdate({ guildId: req.params.guildId, userId: req.params.userId }, { $set: { wallet: 0, bank: 0, transactions: [] } }); return { ok: true };
  });
}

// ── Giveaways ────────────────────────────────────────────────────────────────
async function giveawayRoutes(fastify) {
  fastify.get('/:guildId/giveaways', { preHandler: requireGuildAccess }, async (req) => {
    const filter = { guildId: req.params.guildId };
    if (req.query.status) filter.status = req.query.status;
    return Giveaway.find(filter).sort({ createdAt: -1 }).limit(20);
  });

  fastify.post('/:guildId/giveaways', { preHandler: requireGuildAccess }, async (req) => {
    const g = new Giveaway({ guildId: req.params.guildId, ...req.body, endsAt: new Date(req.body.endsAt), hostedBy: req.session.user.id, hostedByName: req.session.user.globalName || req.session.user.username });
    await g.save(); return g;
  });

  fastify.patch('/:guildId/giveaways/:id/end', { preHandler: requireGuildAccess }, async (req, reply) => {
    const g = await Giveaway.findById(req.params.id);
    if (!g) return reply.code(404).send({ error: 'Not found' });
    const p = [...g.participants]; const winners = [];
    for (let i = 0; i < Math.min(g.winnerCount, p.length); i++) winners.push(p.splice(Math.floor(Math.random() * p.length), 1)[0]);
    g.winners = winners; g.status = 'ended'; g.endedAt = new Date();
    await g.save(); return g;
  });

  fastify.patch('/:guildId/giveaways/:id/reroll', { preHandler: requireGuildAccess }, async (req, reply) => {
    const g = await Giveaway.findById(req.params.id);
    if (!g || g.status !== 'ended') return reply.code(400).send({ error: 'Must be ended' });
    const p = [...g.participants]; const winners = [];
    for (let i = 0; i < Math.min(g.winnerCount, p.length); i++) winners.push(p.splice(Math.floor(Math.random() * p.length), 1)[0]);
    g.winners = winners; await g.save(); return g;
  });

  fastify.delete('/:guildId/giveaways/:id', { preHandler: requireGuildAccess }, async (req) => {
    await Giveaway.findByIdAndDelete(req.params.id); return { ok: true };
  });
}

// ── Tickets ──────────────────────────────────────────────────────────────────
async function ticketRoutes(fastify) {
  fastify.get('/:guildId/tickets', { preHandler: requireGuildAccess }, async (req) => {
    const filter = { guildId: req.params.guildId };
    if (req.query.status) filter.status = req.query.status;
    const { page = 1, limit = 20 } = req.query;
    const total = await Ticket.countDocuments(filter);
    const tickets = await Ticket.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(+limit).select('-transcript');
    return { tickets, total };
  });

  fastify.get('/:guildId/tickets/:ticketId', { preHandler: requireGuildAccess }, async (req, reply) => {
    const t = await Ticket.findOne({ guildId: req.params.guildId, ticketId: +req.params.ticketId });
    if (!t) return reply.code(404).send({ error: 'Not found' });
    return t;
  });

  fastify.patch('/:guildId/tickets/:ticketId/close', { preHandler: requireGuildAccess }, async (req) =>
    Ticket.findOneAndUpdate({ guildId: req.params.guildId, ticketId: +req.params.ticketId }, { $set: { status: 'closed', closedAt: new Date() } }, { new: true }));

  fastify.delete('/:guildId/tickets/:ticketId', { preHandler: requireGuildAccess }, async (req) => {
    await Ticket.findOneAndDelete({ guildId: req.params.guildId, ticketId: +req.params.ticketId }); return { ok: true };
  });
}

// ── Music (proxy to bot) ─────────────────────────────────────────────────────
async function musicRoutes(fastify) {
  fastify.get('/:guildId/music', { preHandler: requireGuildAccess }, async (req) => {
    try { return (await bot(`/music/${req.params.guildId}/state`)).data; }
    catch { return { playing: false, paused: false, current: null, queue: [], volume: 100 }; }
  });
  fastify.post('/:guildId/music/:action', { preHandler: requireGuildAccess }, async (req, reply) => {
    try { return (await bot(`/music/${req.params.guildId}/${req.params.action}`, 'post', req.body)).data; }
    catch { return reply.code(500).send({ error: 'Bot unreachable' }); }
  });
  fastify.delete('/:guildId/music/queue/:index', { preHandler: requireGuildAccess }, async (req, reply) => {
    try { return (await bot(`/music/${req.params.guildId}/queue/${req.params.index}`, 'delete')).data; }
    catch { return reply.code(500).send({ error: 'Bot unreachable' }); }
  });
}

// ── Super Admin ──────────────────────────────────────────────────────────────
async function superAdminRoutes(fastify) {
  fastify.get('/sa/check', { preHandler: requireAuth }, async (req) =>
    ({ isOwner: ['1432367869248672078', '1361760724203864188'].includes(req.session.user.id) }));

  fastify.get('/sa/guilds', { preHandler: requireOwner }, async (req, reply) => {
    try { return (await bot('/guilds')).data; } catch { return reply.code(500).send({ error: 'Bot unreachable' }); }
  });

  fastify.get('/sa/guilds/:guildId/channels', { preHandler: requireOwner }, async (req, reply) => {
    try { return (await bot(`/guilds/${req.params.guildId}/channels`)).data; } catch { return reply.code(500).send({ error: 'Bot unreachable' }); }
  });

  fastify.post('/sa/say', { preHandler: requireOwner }, async (req, reply) => {
    try { await bot('/admin/say', 'post', req.body); return { ok: true }; } catch { return reply.code(500).send({ error: 'Bot unreachable' }); }
  });

  fastify.post('/sa/broadcast', { preHandler: requireOwner }, async (req, reply) => {
    try { return (await bot('/admin/broadcast', 'post', req.body)).data; } catch { return reply.code(500).send({ error: 'Bot unreachable' }); }
  });

  fastify.post('/sa/dm', { preHandler: requireOwner }, async (req, reply) => {
    try { await bot('/admin/dm', 'post', req.body); return { ok: true }; } catch { return reply.code(500).send({ error: 'Bot unreachable' }); }
  });

  fastify.post('/sa/presence', { preHandler: requireOwner }, async (req, reply) => {
    try { await bot('/admin/presence', 'post', req.body); return { ok: true }; } catch { return reply.code(500).send({ error: 'Bot unreachable' }); }
  });

  fastify.get('/sa/botstats', { preHandler: requireOwner }, async (req, reply) => {
    try { return (await bot('/admin/stats')).data; } catch { return reply.code(500).send({ error: 'Bot unreachable' }); }
  });

  fastify.post('/sa/guilds/:guildId/leave', { preHandler: requireOwner }, async (req, reply) => {
    try { await bot(`/admin/leave/${req.params.guildId}`, 'post', {}); return { ok: true }; } catch { return reply.code(500).send({ error: 'Bot unreachable' }); }
  });
}

module.exports = async function apiRoutes(fastify) {
  await fastify.register(battleRoutes);
  await fastify.register(modRoutes);
  await fastify.register(xpRoutes);
  await fastify.register(economyRoutes);
  await fastify.register(giveawayRoutes);
  await fastify.register(ticketRoutes);
  await fastify.register(musicRoutes);
  await fastify.register(superAdminRoutes);
};
