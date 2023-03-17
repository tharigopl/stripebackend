'use strict';

const config = require('../../config');
const stripe = require('stripe')(process.env.STRIPE_SECRETKEY, {
  apiVersion: process.env.STRIPE_API_VERSION || '2022-08-01'
});
const express = require('express');
const router = express.Router();
const Guest = require('../../models/guest');

/* For this demo, we assume that we're always authenticating the
 * latest guest. In a production app, you would also typically
 * have a user authentication system for guests.
 */

// The methods below are required by the Stripe iOS SDK:
// see [STPEphemeralKeyProvider](https://github.com/stripe/stripe-ios/blob/master/Stripe/PublicHeaders/STPEphemeralKeyProvider.h)

/**
 * POST /api/guests/me/ephemeral_keys
 *
 * Generate an ephemeral key for the logged in customer.
 */
router.post('/me/ephemeral_keys', async (req, res, next) => {
  const apiVersion = req.body['api_version'];
  try {
    // Find the latest guest (see note above)
    const guest = await Guest.getLatest();
    // Create ephemeral key for customer
    const ephemeralKey = await stripe.ephemeralKeys.create(
      {
        customer: guest.stripeCustomerId,
      },
      {
        stripe_version: apiVersion,
      }
    );
    // Respond with ephemeral key
    res.send(ephemeralKey);
  } catch (err) {
    res.sendStatus(500);
    next(`Error creating ephemeral key for customer: ${err.message}`);
  }
});

module.exports = router;
