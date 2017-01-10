var path = require('path');
const webpack = require('webpack'); // to access built-in plugins

module.exports = {
  entry: './lib/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: './lib/my-first-webpack.bundle.js'
  }
   plugins: [
    new webpack.optimize.UglifyJsPlugin()
  ]
};

module.exports = config;