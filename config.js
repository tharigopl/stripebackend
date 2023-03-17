'use strict';

module.exports = {
  // App name
  appName: 'MomPop',

  // Public domain of MomPop
  publicDomain: 'http://localhost:3000',

  // Server port
  port: 3000,

  // Secret for cookie sessions
  secret: 'This is the secret of the life of pi in the evolution of the human species',

  // Configuration for Stripe
  // API Keys: https://dashboard.stripe.com/account/apikeys
  // Connect Settings: https://dashboard.stripe.com/account/applications/settings
  stripe: {
    //secretKey: `${process.env.STRIPE_SECRETKEY}`,    
    //publishableKey: `${process.env.STRIPE_PUBLISHABLEKEY}`,
    secretKey: 'sk_test_51MfwOdIG1pb0YbjaRmbi6me1FuzawPzUfSC3KXuqFMt2NhpHyHIb5Z2VxCUf0trxixFt1D1Viu2q3wNvzhxpylGG00f8wQbXwt',
    publishableKey: 'pk_test_51MfwOdIG1pb0YbjaCLWZMdycVQH2T9qAxPor8ZbqMNg1MBKwYYlWCwtjdozSqCOfT2yTfULEIgDy3khfCqp07NcT0058OOSqK6',
    apiVersion: '2022-11-15'
  },

  // Configuration for MongoDB
  //Mongo cloud
  //mongoUri: `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.34y8vqt.mongodb.net/${process.env.DB_NAME}`,
  mongoUri: 'mongodb+srv://tharigopla:Tharigopla123@cluster0.34y8vqt.mongodb.net/test',
  //mongoUri: 'mongodb+srv://dataadmin:Tharigopla123!@cluster0.34y8vqt.mongodb.net/test?retryWrites=true&w=majority',
  //mongoUri: 'mongodb+srv://dataadmin:Tharigopla123!@cluster0.34y8vqt.mongodb.net/test?retryWrites=true&w=majority',
 //mongoUri: 'mongodb://localhost:27017/',

  // Configuration for Google Cloud (only useful if you want to deploy to GCP)
  gcloud: {
    projectId: 'YOUR_PROJECT_ID'
  }
};
