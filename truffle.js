module.exports = {
  build: {
    "index.html": "index.html",
    "app.js": [
      "javascripts/app.js"
    ],
    "app.css": [
      "stylesheets/app.css"
    ],
    "images/": "images/"
  },
  networks: {
    "private" : {
      network_id: 2387
    }
  },
  rpc: {
    host: "localhost",
    port: 8545
  }
};
