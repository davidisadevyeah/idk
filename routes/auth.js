const axios = require('axios');

const DISCORD_API = 'https://discord.com/api/v10';

module.exports = async function authRoutes(fastify) {
  fastify.get('/login', async (req, reply) => {
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify guilds',
    });
    reply.redirect(`https://discord.com/oauth2/authorize?${params}`);
  });

  fastify.get('/callback', async (req, reply) => {
    const { code } = req.query;
    if (!code) return reply.redirect('/?error=no_code');

    try {
      const tokenRes = await axios.post(`${DISCORD_API}/oauth2/token`,
        new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: process.env.DISCORD_REDIRECT_URI,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const { access_token } = tokenRes.data;

      const [userRes, guildsRes] = await Promise.all([
        axios.get(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${access_token}` } }),
        axios.get(`${DISCORD_API}/users/@me/guilds`, { headers: { Authorization: `Bearer ${access_token}` } }),
      ]);

      const user = userRes.data;
      const manageable = guildsRes.data.filter(g => {
        const p = BigInt(g.permissions);
        return g.owner || (p & BigInt(0x8)) === BigInt(0x8) || (p & BigInt(0x20)) === BigInt(0x20);
      });

      req.session.user = {
        id: user.id,
        username: user.username,
        globalName: user.global_name,
        avatar: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
          : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || '0') % 5}.png`,
        guilds: manageable,
      };

      reply.redirect('/dashboard');
    } catch (err) {
      fastify.log.error(err.response?.data || err.message);
      reply.redirect('/?error=auth_failed');
    }
  });

  fastify.get('/me', async (req, reply) => {
    if (!req.session?.user) return reply.send(null);
    const { id, username, globalName, avatar, guilds } = req.session.user;
    return { id, username, globalName, avatar, guilds };
  });

  fastify.post('/logout', async (req, reply) => {
    await req.session.destroy();
    return { ok: true };
  });
};
