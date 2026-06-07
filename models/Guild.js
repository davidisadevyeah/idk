const mongoose = require('mongoose');
const GuildSchema = new mongoose.Schema({ guildId:{type:String,required:true,unique:true}, name:String, icon:String, prefix:{type:String,default:'!'}, settings:{ logChannel:String, modChannel:String, welcomeChannel:String, musicChannel:String, battleChannel:String, ticketCategory:String, xpEnabled:{type:Boolean,default:true}, economyEnabled:{type:Boolean,default:true} }, updatedAt:{type:Date,default:Date.now} });
module.exports = mongoose.model('Guild', GuildSchema);
