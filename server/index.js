import { PeerServer } from 'peer';

const port = 9000;

const peerServer = PeerServer({
  port: port,
  path: '/jade-night',
  allow_discovery: true,
  // proxied: true, // Removed as it can cause issues in local setups
  corsOptions: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

console.log(`PeerServer running on port ${port}`);
console.log(`Discovery endpoint: http://localhost:${port}/jade-night/peerjs/peers`);
