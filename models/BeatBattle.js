const mongoose = require('mongoose');
const Sub = new mongoose.Schema({ userId:String, username:String, avatar:String, trackUrl:String, trackName:String, submittedAt:{type:Date,default:Date.now} });
const Vote = new mongoose.Schema({ userId:String, votedFor:String, votedAt:{type:Date,default:Date.now} });
const BeatBattleSchema = new mongoose.Schema({ guildId:{type:String,required:true}, title:{type:String,default:'Beat Battle'}, status:{type:String,enum:['open','voting','ended'],default:'open'}, theme:String, submissions:[Sub], votes:[Vote], winner:{userId:String,username:String,trackName:String}, submissionDeadline:Date, votingDeadline:Date, messageId:String, channelId:String, createdBy:String, createdAt:{type:Date,default:Date.now}, endedAt:Date });
module.exports = mongoose.model('BeatBattle', BeatBattleSchema);
