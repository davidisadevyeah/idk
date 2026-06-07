const mongoose = require('mongoose');
const Msg = new mongoose.Schema({ userId:String, username:String, avatar:String, content:String, timestamp:{type:Date,default:Date.now} });
const TicketSchema = new mongoose.Schema({ guildId:{type:String,required:true}, ticketId:Number, channelId:String, userId:String, username:String, avatar:String, subject:String, category:{type:String,default:'General'}, status:{type:String,enum:['open','claimed','closed'],default:'open'}, claimedBy:String, claimedByName:String, transcript:[Msg], createdAt:{type:Date,default:Date.now}, closedAt:Date });
TicketSchema.pre('save', async function(next){ if(this.isNew){ const last=await this.constructor.findOne({guildId:this.guildId}).sort({ticketId:-1}); this.ticketId=last?(last.ticketId||0)+1:1; } next(); });
module.exports = mongoose.model('Ticket', TicketSchema);
