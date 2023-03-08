'use strict';

const config = require('../config');
const stripe = require('stripe')(config.stripe.secretKey, {
  apiVersion: config.stripe.apiVersion || '2022-08-01'
});
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Use native promises.
mongoose.Promise = global.Promise;

// Define the Guest schema.
const GuestSchema = new Schema({
  email: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  created: { type: Date, default: Date.now },

  // Stripe customer ID storing the payment sources.
  stripeCustomerId: String
});

// Return a guest name for display.
GuestSchema.methods.displayName = function() {
  return `${this.firstName} ${this.lastName.charAt(0)}.`;
};

// Get the latest guest.
GuestSchema.statics.getLatest = async function() {
  try {
    // Count all the guests.
    const count = await Guest.countDocuments().exec();
    if (count === 0) {
      // Create default guests.
      await Guest.insertDefaultGuests();
    }
    // Return latest guest.
    return Guest.findOne()
      .sort({ created: -1 })
      .exec();
  } catch (err) {
    console.log(err);
  }
};

// Find a random guest.
GuestSchema.statics.getRandom = async function() {
  try {
    // Count all the guests.
    const count = await Guest.countDocuments().exec();
    if (count === 0) {
      // Create default guests.
      await Guest.insertDefaultGuests();
    }
    // Returns a document after skipping a random amount.
    const random = Math.floor(Math.random() * count);
    return Guest.findOne().skip(random).exec();
  } catch (err) {
    console.log(err);
  }
};

// Create a few default guests for the platform to simulate gifts.
GuestSchema.statics.insertDefaultGuests = async function() {
  try {
    const data = [{
      firstName: 'Jenny',
      lastName: 'Rosen',
      email: 'jenny.rosen@example.com'
    }, {
      firstName: 'Kathleen',
      lastName: 'Banks',
      email: 'kathleen.banks@example.com'
    }, {
      firstName: 'Victoria',
      lastName: 'Thompson',
      email: 'victoria.thompson@example.com'
    }, {
      firstName: 'Ruth',
      lastName: 'Hamilton',
      email: 'ruth.hamilton@example.com'
    }, {
      firstName: 'Emma',
      lastName: 'Lane',
      email: 'emma.lane@example.com'
    }];
    for (let object of data) {
      const guest = new Guest(object);
      // Create a Stripe account for each of the guests.
      const customer = await stripe.customers.create({
        email: guest.email,
        description: guest.displayName()
      });
      guest.stripeCustomerId = customer.id;
      await guest.save();
    }
  } catch (err) {
    console.log(err);
  }
};

const Guest = mongoose.model('Guest', GuestSchema);

module.exports = Guest;
