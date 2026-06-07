const mongoose = require('mongoose');
const GiveawaySchema = new mongoose.Schema({ guildId:{type:String,required:true}, channelId:String, messageId:String, prize:{type:String,required:true}, description:String, winnerCount:{type:Number,default:1}, participants:[String], winners:[String], hostedBy:String, hostedByName:String, status:{type:String,enum:['active','ended','cancelled'],default:'active'}, endsAt:{type:Date,required:true}, endedAt:Date, createdAt:{type:Date,default:Date.now} });
module.exports = mongoose.model('Giveaway', GiveawaySchema);
