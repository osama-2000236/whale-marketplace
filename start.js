const server = require('./server');
if (typeof server.start === 'function' && process.env.NODE_ENV === 'test') {
  server.start();
}
