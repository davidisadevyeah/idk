const mongoose = require('mongoose');
const XPSchema = new mongoose.Schema({ guildId:{type:String,required:true}, userId:{type:String,required:true}, username:String, avatar:String, xp:{type:Number,default:0}, level:{type:Number,default:0}, totalMessages:{type:Number,default:0}, lastMessage:Date, updatedAt:{type:Date,default:Date.now} });
XPSchema.index({guildId:1,userId:1},{unique:true}); XPSchema.index({guildId:1,xp:-1});
module.exports = mongoose.model('XP', XPSchema);
