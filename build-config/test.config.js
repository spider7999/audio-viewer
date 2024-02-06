const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
module.exports = {
  entry: {index: './src/test-html-init.js',},
  plugins: [
  	  new HtmlWebpackPlugin({title: '管理输出'})
  ],
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, '../dist'),
	clean: true,
  },
  mode: 'development',
  optimization: {
	  runtimeChunk: 'single'
  }
};