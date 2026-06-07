const mongoose = require('mongoose');
const ModlogSchema = new mongoose.Schema({ guildId:{type:String,required:true}, userId:{type:String,required:true}, username:String, avatar:String, action:{type:String,enum:['warn','mute','kick','ban','unban','unmute'],required:true}, reason:{type:String,default:'No reason provided'}, moderatorId:String, moderatorName:String, duration:Number, expiresAt:Date, active:{type:Boolean,default:true}, caseId:Number, createdAt:{type:Date,default:Date.now} });
ModlogSchema.pre('save', async function(next){ if(this.isNew){ const last=await this.constructor.findOne({guildId:this.guildId}).sort({caseId:-1}); this.caseId=last?(last.caseId||0)+1:1; } next(); });
module.exports = mongoose.model('Modlog', ModlogSchema);
