const { requireAuth, requireGuildAccess } = require('./middleware');
const Guild = require('../models/Guild');
const Modlog = require('../models/Modlog');
const XP = require('../models/XP');
const BeatBattle = require('../models/BeatBattle');
const Giveaway = require('../models/Giveaway');
const Ticket = require('../models/Ticket');

module.exports = async function guildRoutes(fastify) {
  fastify.get('/', { preHandler: requireAuth }, async (req) => {
    return req.session.user.guilds.map(g => ({
      ...g,
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
    }));
  });

  fastify.get('/:guildId', { preHandler: requireGuildAccess }, async (req) => {
    let guild = await Guild.findOne({ guildId: req.params.guildId });
    if (!guild) {
      guild = new Guild({ guildId: req.params.guildId, name: req.guild?.name });
      await guild.save();
    }
    return guild;
  });

  fastify.patch('/:guildId', { preHandler: requireGuildAccess }, async (req) => {
    return Guild.findOneAndUpdate(
      { guildId: req.params.guildId },
      { $set: { ...req.body, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
  });

  fastify.get('/:guildId/stats', { preHandler: requireGuildAccess }, async (req) => {
    const { guildId } = req.params;
    const [totalWarns, totalBans, totalMembers, activeBattle, activeGiveaways, openTickets] = await Promise.all([
      Modlog.countDocuments({ guildId, action: 'warn', active: true }),
      Modlog.countDocuments({ guildId, action: 'ban', active: true }),
      XP.countDocuments({ guildId }),
      BeatBattle.findOne({ guildId, status: { $ne: 'ended' } }),
      Giveaway.countDocuments({ guildId, status: 'active' }),
      Ticket.countDocuments({ guildId, status: { $in: ['open', 'claimed'] } }),
    ]);
    return { totalWarns, totalBans, totalMembers, activeBattle: !!activeBattle, activeGiveaways, openTickets };
  });
};
