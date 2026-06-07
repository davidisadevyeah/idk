const OWNER_IDS = ['1432367869248672078', '1361760724203864188'];

async function requireAuth(req, reply) {
  if (!req.session?.user) return reply.code(401).send({ error: 'Unauthorized' });
}

async function requireOwner(req, reply) {
  if (!req.session?.user) return reply.code(401).send({ error: 'Unauthorized' });
  if (!OWNER_IDS.includes(req.session.user.id)) return reply.code(403).send({ error: 'Owners only' });
}

async function requireGuildAccess(req, reply) {
  if (!req.session?.user) return reply.code(401).send({ error: 'Unauthorized' });
  const { guildId } = req.params;
  const guild = req.session.user.guilds?.find(g => g.id === guildId);
  if (!guild) return reply.code(403).send({ error: 'No access to this server' });
  req.guild = guild;
}

module.exports = { requireAuth, requireOwner, requireGuildAccess, OWNER_IDS };
