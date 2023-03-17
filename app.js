'use strict';

const config = require('./config');
const express = require('express');
const session = require('cookie-session');
const passport = require('passport');
const path = require('path');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const flash = require('express-flash');
const bodyParser = require('body-parser');
const moment = require('moment');

const app = express();
app.set('trust proxy', true);

// MongoDB configuration
const mongoose = require('mongoose');
const connectRetry = function() {
  console.log("Token ", process.env.DB_NAME);
  const mongouri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.34y8vqt.mongodb.net/${process.env.DB_NAME}`;
  mongoose.connect(mongouri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    poolSize: 500,
  }, (err) => {
    if (err) {
      console.log('Mongoose connection error:', err);
      setTimeout(connectRetry, 5000);
    }
  });
}
connectRetry();

// Set up the view engine
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Enable sessions using encrypted cookies
app.use(cookieParser(config.secret));
app.use(
  session({
    cookie: {maxAge: 60000},
    secret: config.secret,
    signed: true,
    resave: true,
  })
);
// Set up flash messages
app.use(flash());

// Set up useful middleware
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Passport and restore any existing authentication state
app.use(passport.initialize());
app.use(passport.session());

// Middleware that exposes the host object (if any) to views
app.use((req, res, next) => {
  if (req.user) {
    res.locals.host = req.user;
  }
  next();
});
app.locals.moment = moment;

// CRUD routes for the host signup and dashboard
//app.use('/hosts', require('./routes/hosts/hosts'));
//app.use('/hosts/stripe', require('./routes/hosts/stripe'));
app.use('/hosts', require('./routes/hosts/hosts'));
app.use('/hosts/stripe', require('./routes/hosts/stripe'));
app.use('/hosts/updatedstripe', require('./routes/hosts/updatedstripe'));
//app.use('/users', require('./routes/users/users'));
//app.use('/users/stripe', require('./routes/users/stripe'));

// API routes for gifts and guests used by the mobile app
app.use('/api/settings', require('./routes/api/settings'));
app.use('/api/gifts', require('./routes/api/gifts'));
app.use('/api/guests', require('./routes/api/guests'));

// Index page for Rocket Gifts
app.get('/', (req, res) => {
  res.render('index');
});

// Respond to the Google Cloud health check
app.get('/_ah/health', (req, res) => {
  res.type('text').send('ok');
});

// Catch 404 errors and forward to error handler
app.use((req, res, next) => {
  res.status(404).render('404');
});

// Development error handler: will print stacktrace
if (app.get('env') === 'development') {
  app.use((err, req, res) => {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err,
    });
  });
}

// Production error handler: no stacktraces will be leaked to user
app.use((err, req, res) => {
  console.log(err);
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {},
  });
});

// Start the server on the correct port
const server = app.listen(process.env.PORT || config.port, () => {
  console.log('🚀 Mom Pop server started:', config.publicDomain);
});
