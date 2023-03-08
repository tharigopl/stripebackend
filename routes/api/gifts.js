'use strict';

const config = require('../../config');
const stripe = require('stripe')(config.stripe.secretKey, {
  apiVersion: config.stripe.apiVersion || '2022-08-01'
});
const express = require('express');
const router = express.Router();
const Host = require('../../models/host');
const Guest = require('../../models/guest');
const Gift = require('../../models/gift');

/* For this demo, we assume that we're always authenticating the
 * latest guest. In a production app, you would also typically
 * have a user authentication system for guests.
 */

/**
 * POST /api/gifts
 *
 * Create a new gift with the corresponding parameters.
 */
router.post('/', async (req, res, next) => {
  /* Important: For this demo, we're trusting the `amount` and `currency`
   * coming from the client request.
   * A real application should absolutely ensure the `amount` and `currency`
   * are securely computed on the backend to make sure the user can't change
   * the payment amount from their web browser or client-side environment.
   */
  const {paymentMethod, amount, currency} = req.body;

  try {
    // For the purpose of this demo, we'll assume we are automatically
    // matched with the first fully-onboarded host rather than using their location.
    const host = await Host.getFirstOnboarded();
    // Find the latest guest (see note above)
    const guest = await Guest.getLatest();

    if(!host || !guest) {
      throw `Could not get ${!host ? "host" : "guest"} details.`
    }

    // Create a new gift
    const gift = new Gift({
      host: host.id,
      guest: guest.id,
      amount: amount,
      currency: currency,
    });
    // Save the gift
    await gift.save();

    const paymentMethods = await stripe.paymentMethods.list({
      customer: guest.stripeCustomerId,
      type: 'card',
    });

    // This only works for the latest customer attached card.      
    const latest_pm = paymentMethods.data[0].id;
    
    // Create a Payment Intent and set its destination to the host's account
    const paymentIntent = await stripe.paymentIntents.create({
      amount: gift.amount,
      currency: gift.currency,
      description: config.appName,
      statement_descriptor: config.appName,
      // The destination parameter directs the transfer of funds from platform to host
      customer: guest.stripeCustomerId,
      payment_method: latest_pm,
      confirm: true,
      transfer_data: {
        // Send the amount for the host after collecting a 20% platform fee:
        // the `amountForHost` method simply computes `gift.amount * 0.8`
        amount: gift.amountForHost(),
        // The destination of this Payment Intent is the host's Stripe account
        destination: host.stripeAccountId,
      },
    });

    // Add the Stripe Payment Intent reference to the gift and save it
    gift.stripePaymentIntentId = paymentIntent.id;
    gift.save();

    // Return the gift info
    res.send({
      host_name: host.displayName(),
      host_vehicle: host.rocket.model,
      host_license: host.rocket.license,
    });
  } catch (err) {
    res.sendStatus(500);
    next(`Error adding token to customer: ${err.message || err}`);
  }
});

module.exports = router;
