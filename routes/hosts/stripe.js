'use strict';

const config = require('../../config');
const stripe = require('stripe')(process.env.STRIPE_SECRETKEY, {
  apiVersion: process.env.STRIPE_API_VERSION || '2022-08-01'
});
//const request = require('request-promise-native');
const querystring = require('querystring');
const express = require('express');
const router = express.Router();

// Middleware that requires a logged-in host
function hostRequired(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/hosts/login');
  } 
  next();
}

/**
 * GET /hosts/stripe/authorize
 *
 * Redirect to Stripe to set up payments.
 */
router.get('/authorize', hostRequired, async (req, res, next) => {
  // Generate a random string as `state` to protect from CSRF and include it in the session
  req.session.state = Math.random()
    .toString(36)
    .slice(2);

  try {
    let accountId = req.user.stripeAccountId;

    // Create a Stripe account for this user if one does not exist already
    if (accountId == undefined) {
      // Define the parameters to create a new Stripe account with
      let accountParams = {
        type: 'express',
        country: req.user.country || undefined,
        email: req.user.email || undefined,
        business_type: req.user.type || 'individual', 
      }
  
      // Companies and invididuals require different parameters
      if (accountParams.business_type === 'company') {
        accountParams = Object.assign(accountParams, {
          company: {
            name: req.user.businessName || undefined
          }
        });
      } else {
        accountParams = Object.assign(accountParams, {
          individual: {
            first_name: req.user.firstName || undefined,
            last_name: req.user.lastName || undefined,
            email: req.user.email || undefined
          }
        });
      }
      console.log("Account Params in stripe.js ", accountParams);
      const account = await stripe.accounts.create(accountParams);
      accountId = account.id;

      // Update the model and store the Stripe account ID in the datastore:
      // this Stripe account ID will be used to issue payouts to the host
      req.user.stripeAccountId = accountId;
      console.log("req.user in /authorize", req.user);
      await req.user.save();
    }

    // Create an account link for the user's Stripe account
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: config.publicDomain + '/hosts/stripe/authorize',
      return_url: config.publicDomain + '/hosts/stripe/onboarded',
      type: 'account_onboarding'
    });

    // Redirect to Stripe to start the Express onboarding flow
    res.redirect(accountLink.url);
  } catch (err) {
    console.log('Failed to create a Stripe account.');
    console.log(err);
    next(err);
  }
});

/**
 * GET /hosts/stripe/onboarded
 *
 * Return endpoint from Stripe onboarding, checks if onboarding has been completed
 */
router.get('/onboarded', hostRequired, async (req, res, next) => {
  try {
    // Retrieve the user's Stripe account and check if they have finished onboarding
    const account = await stripe.account.retrieve(req.user.stripeAccountId);
    if (account.details_submitted) {
      req.user.onboardingComplete = true;
      await req.user.save();
      console.log("Request.user", req.user);
      // Redirect to the Rocket Rides dashboard
      req.flash('showBanner', 'true');
      res.redirect('/hosts/dashboard');
    } else {
      console.log('The onboarding process was not completed.');
      res.redirect('/hosts/signup');
    }
  } catch (err) {
    console.log('Failed to retrieve Stripe account information.');
    console.log(err);
    next(err);
  }
})

/**
 * GET /hosts/stripe/dashboard
 *
 * Redirect to the hosts' Stripe Express dashboard to view payouts and edit account details.
 */
router.get('/dashboard', hostRequired, async (req, res) => {
  const host = req.user;
  // Make sure the logged-in host completed the Express onboarding
  if (!host.onboardingComplete) {
    return res.redirect('/hosts/signup');
  }
  try {
    // Generate a unique login link for the associated Stripe account to access their Express dashboard
    const loginLink = await stripe.accounts.createLoginLink(
      host.stripeAccountId, {
        redirect_url: config.publicDomain + '/hosts/dashboard'
      }
    );
    // Directly link to the account tab
    if (req.query.account) {
      loginLink.url = loginLink.url + '#/account';
    }
    // Retrieve the URL from the response and redirect the user to Stripe
    return res.redirect(loginLink.url);
  } catch (err) {
    console.log(err);
    console.log('Failed to create a Stripe login link.');
    return res.redirect('/hosts/signup');
  }
});

/**
 * POST /hosts/stripe/payout
 *
 * Generate a payout with Stripe for the available balance.
 */
router.post('/payout', hostRequired, async (req, res) => {
  const host = req.user;
  try {
    // Fetch the account balance to determine the available funds
    const balance = await stripe.balance.retrieve({
      stripeAccount: host.stripeAccountId,
    });
    // This demo app only uses USD so we'll just use the first available balance
    // (Note: there is one balance for each currency used in your application)
    const {amount, currency} = balance.available[0];
    // Create a payout
    const payout = await stripe.payouts.create({
      amount: amount,
      currency: currency,
      statement_descriptor: config.appName,
    }, {stripeAccount: host.stripeAccountId });
  } catch (err) {
    console.log(err);
  }
  res.redirect('/hosts/dashboard');
});

module.exports = router;
