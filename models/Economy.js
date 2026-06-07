const mongoose = require('mongoose');
const Tx = new mongoose.Schema({ type:String, amount:Number, description:String, fromUser:String, toUser:String, timestamp:{type:Date,default:Date.now} });
const EconomySchema = new mongoose.Schema({ guildId:{type:String,required:true}, userId:{type:String,required:true}, username:String, avatar:String, wallet:{type:Number,default:0}, bank:{type:Number,default:0}, lastDaily:Date, lastWork:Date, transactions:[Tx], updatedAt:{type:Date,default:Date.now} });
EconomySchema.index({guildId:1,userId:1},{unique:true});
module.exports = mongoose.model('Economy', EconomySchema);
