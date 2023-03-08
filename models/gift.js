'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Use native promises.
mongoose.Promise = global.Promise;

// Define the Gift schema.
const GiftSchema = new Schema({
  host: { type : Schema.ObjectId, ref : 'Host', required: true },
  guest: { type : Schema.ObjectId, ref : 'Guest', required: true },
  origin: { type: [Number], index: '2d', sparse: true, default: [37.7765030, -122.3920385] },
  destination: { type: [Number], index: '2d', sparse: true, default: [37.8199286, -122.4782551] },
  pickupTime: { type: Date, default: Date.now },
  dropoffTime: { type: Date, default: new Date((new Date).getTime() + Math.floor(10 * Math.random()) * 60000) },
  amount: Number,
  currency: { type: String, default: 'usd' },
  created: { type: Date, default: Date.now },

  // Stripe Payment Intent ID corresponding to this gift.
  stripePaymentIntentId: String
});

// Return the gift amount for the host after collecting 20% platform fees.
GiftSchema.methods.amountForHost = function() {
  return parseInt(this.amount * 0.8);
};

const Gift = mongoose.model('Gift', GiftSchema);

module.exports = Gift;
