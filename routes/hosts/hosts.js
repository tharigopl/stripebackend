'use strict';

const config = require('../../config');
const stripe = require('stripe')(config.stripe.secretKey, {
  apiVersion: config.stripe.apiVersion || '2022-08-01'
});
const express = require('express');
const router = express.Router();
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const Host = require('../../models/host');
const Gift = require('../../models/gift');
const Guest = require('../../models/guest');

// Middleware: require a logged-in host
function hostRequired(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/hosts/login');
  }
  next();
}

// Helper function: get the currency symbol for the given country ISO code
const getCurrencySymbol = currency => {
  const currencySymbol = new Intl.NumberFormat('en', {
    currency,
    style: 'currency'
  }).formatToParts(0).find(part => part.type === 'currency');
  return currencySymbol && currencySymbol.value;
}

/**
 * GET /hosts/dashboard
 *
 * Show the Dashboard for the logged-in host with the overview,
 * their gift history, and the ability to simulate a test gift.
 *
 * Use the `hostRequired` middleware to ensure that only logged-in
 * hosts can access this route.
 */
router.get('/dashboard', hostRequired, async (req, res) => {
  const host = req.user;
  // Retrieve the balance from Stripe
  console.log("Stripe id", host.stripeAccountId);
  const balance = await stripe.balance.retrieve({
    stripeAccount: host.stripeAccountId,
  });
  // Fetch the host's recent gifts
  const gifts = await host.listRecentGifts();
  const giftsTotalAmount = gifts.reduce((a, b) => {
    return a + b.amountForHost();
  }, 0);
  const [showBanner] = req.flash('showBanner');
  // There is one balance for each currencies used: as this 
  // demo app only uses USD we'll just use the first object
  res.render('dashboard', {
    host: host,
    balanceAvailable: balance.available[0].amount,
    balancePending: balance.pending[0].amount,
    giftsTotalAmount: giftsTotalAmount,
    balanceCurrency: getCurrencySymbol(balance.available[0].currency),
    gifts: gifts,
    showBanner: !!showBanner || req.query.showBanner,
  });
});

/**
 * POST /hosts/gifts
 *
 * Generate a test gift with sample data for the logged-in host.
 */
router.post('/gifts', hostRequired, async (req, res, next) => {
  const host = req.user;
  // Find a random guest
  const guest = await Guest.getRandom();
  // Create a new gift for the host and this random guest
  const gift = new Gift({
    host: host.id,
    guest: guest.id,
    // Generate a random amount between $10 and $100 for this gift
    amount: getRandomInt(1000, 10000),
  });
  // Save the gift
  await gift.save();
  try {
    // Get a test source, using the given testing behavior
    let source;
    if (req.body.immediate_balance) {
      source = getTestSource('immediate_balance');
    } else if (req.body.payout_limit) {
      source = getTestSource('payout_limit');
    }
    let charge;
    // Accounts created in Japan have the `full` service agreement and must create their own card payments
    if (host.country === 'JP') {
      // Create a Destination Charge to the host's account
      charge = await stripe.charges.create({
        source: source,
        amount: gift.amount,
        currency: gift.currency,
        description: config.appName,
        statement_descriptor: config.appName,
        on_behalf_of: host.stripeAccountId,
        // The destination parameter directs the transfer of funds from platform to host
        transfer_data: {
          // Send the amount for the host after collecting a 20% platform fee:
          // the `amountForHost` method simply computes `gift.amount * 0.8`
          amount: gift.amountForHost(),
          // The destination of this charge is the host's Stripe account
          destination: host.stripeAccountId,
        },
      });
    } else {
      // Accounts created in any other country use the more limited `recipients` service agreement (with a simpler
      // onboarding flow): the platform creates the charge and then separately transfers the funds to the recipient.
      charge = await stripe.charges.create({
        source: source,
        amount: gift.amount,
        currency: gift.currency,
        description: config.appName,
        statement_descriptor: config.appName,
        // The `transfer_group` parameter must be a unique id for the gift; it must also match between the charge and transfer
        transfer_group: gift.id
      });
      const transfer = await stripe.transfers.create({
        amount: gift.amountForHost(),
        currency: gift.currency,
        destination: host.stripeAccountId,
        transfer_group: gift.id
      })
    }
    // Add the Stripe charge reference to the gift and save it
    gift.stripeChargeId = charge.id;
    gift.save();
  } catch (err) {
    console.log(err);
    // Return a 402 Payment Required error code
    res.sendStatus(402);
    next(`Error adding token to customer: ${err.message}`);
  }
  res.redirect('/hosts/dashboard');
});

/**
 * GET /hosts/signup
 *
 * Display the signup form on the right step depending on the current completion.
 */
router.get('/signup', (req, res) => {
  let step = 'account';
  // Naive way to identify which step we're on: check for the presence of user profile data
  if (req.user) {
    if (
      req.user.type === 'individual'
        ? !req.user.firstName || !req.user.lastName
        : !req.user.businessName
    ) {
      step = 'profile';
    } else if (!req.user.onboardingComplete) {
      step = 'payments';
    } else {
      step = 'done';
    }
  }
  res.render('signup', {step: step});
});

/**
 * POST /hosts/signup
 *
 * Create a user and update profile information during the host onboarding process.
 */
router.post('/signup', async (req, res, next) => {
  const body = Object.assign({}, req.body, {
    // Use `type` instead of `host-type` for saving to the DB.
    type: req.body['host-type'],
    'host-type': undefined,
  });

  // Check if we have a logged-in host
  let host = req.user;
  if (!host) {
    try {
      // Try to create and save a new host
      host = new Host(body);
      host = await host.save()
      // Sign in and redirect to continue the signup process
      req.logIn(host, err => {
        if (err) next(err);
        return res.redirect('/hosts/signup');
      });
    } catch (err) {
      console.log(err); 
      // Show an error message to the user
      const errors = Object.keys(err.errors).map(field => err.errors[field].message);
      res.render('signup', { step: 'account', error: errors[0] });
    }
  } 
  else {
    try {
      // Try to update the logged-in host using the newly entered profile data
      host.set(body);
      await host.save();
      return res.redirect('/hosts/stripe/authorize');
    } catch (err) {
      next(err);
    }
  }
});

/**
 * GET /hosts/login
 *
 * Simple host login.
 */
router.get('/login', (req, res) => {
  res.render('login');
});

/**
 * GET /hosts/login
 *
 * Simple host login.
 */
router.post(
  '/login',
  passport.authenticate('host-login', {
    successRedirect: '/hosts/dashboard',
    failureRedirect: '/hosts/login',
  })
);

/**
 * GET /hosts/logout
 *
 * Delete the host from the session.
 */
router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

// Serialize the host's sessions for Passport
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  try {
    let user = await Host.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Define the login strategy for hosts based on email and password
passport.use('host-login', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  let user;
  try {
    user = await Host.findOne({email});
    if (!user) {
      return done(null, false, { message: 'Unknown user' });
    }
  } catch (err) {
    return done(err);
  }
  if (!user.validatePassword(password)) {
    return done(null, false, { message: 'Invalid password' });
  }
  return done(null, user);
}));

// Function that returns a test card token for Stripe
function getTestSource(behavior) {
  // Important: We're using static tokens based on specific test card numbers
  // to trigger a special behavior. This is NOT how you would create real payments!
  // You should use Stripe Elements or Stripe iOS/Android SDKs to tokenize card numbers.
  // Use a static token based on a test card: https://stripe.com/docs/testing#cards
  var source = 'tok_visa';
  // We can use a different test token if a specific behavior is requested
  if (behavior === 'immediate_balance') {
    source = 'tok_bypassPending';
  } else if (behavior === 'payout_limit') {
    source = 'tok_visa_triggerTransferBlock';
  }
  return source;
}

// Return a random int between two numbers
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = router;
