// Set your secret key. Remember to switch to your live secret key in production.
// See your keys here: https://dashboard.stripe.com/apikeys
const stripe = require('stripe')('sk_test_51MfwOdIG1pb0YbjaRmbi6me1FuzawPzUfSC3KXuqFMt2NhpHyHIb5Z2VxCUf0trxixFt1D1Viu2q3wNvzhxpylGG00f8wQbXwt');

const paymentIntent = await stripe.paymentIntents.create({
  amount: 1099,
  currency: 'usd',
});
const clientSecret = paymentIntent.client_secret
// Pass the client secret to the client