const app = require('../server/app');

// Vercel Serverless Function entry point
console.log(`[Vercel Serverless] Function container loaded | Node: ${process.version} | NODE_ENV: ${process.env.NODE_ENV || 'unspecified'}`);

module.exports = app;
