const path = require('node:path');
const argv = require('minimist')(process.argv.slice(1));

const webpack = require('webpack');
const terserPlugin = require('terser-webpack-plugin');

const isProd = process.env['MODE'] === 'production' || argv.mode === 'production';

/** @type {import('webpack').Configuration} */
const options = {
  context: path.resolve(__dirname, 'src'),
  devtool: isProd ? false : 'inline-source-map',
  target: ['web', 'es5'],
  mode: isProd ? 'production' : 'development',
  entry: {
    plugin: './plugin.ts',
  },
  node: {
    global: false
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    chunkFilename: '[chunkhash].js',
    libraryTarget: 'umd',
    globalObject: '(typeof self !== "undefined" ? self : this)',
    umdNamedDefine: false
  },
  plugins: [
    new webpack.DefinePlugin({ 'Authentication': 'window.Authentication' })
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: './.babel',
              presets: [
                [
                  '@babel/preset-env',
                  {
                    corejs: false,
                    targets: {
                      // no targets result in transpilation to ES5
                    }
                  }
                ]
              ]
            }
          },
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.json'
            }
          },
          {
            loader: 'source-map-loader'
          }
        ]
      },
      {
        test: /\.m?js$/,
        // we transpile node_modules with babel,
        // because webpack doesn't transpile all new features,
        // such as private class features
        include: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            browserslistConfigFile: false,
            cacheDirectory: './.babel',
            presets: [
              [
                '@babel/preset-env',
                {
                  corejs: false,
                  exclude: ['@babel/plugin-transform-regenerator'],
                  targets: {
                    // no targets result in transpilation to ES5
                  }
                }
              ]
            ]
          }
        }
      }
    ]
  },
  externals: [],
  externalsPresets: {
    node: true,
    web: true
  },
  resolve: {
    extensions: ['.ts', '.js'],
    plugins: []
  },
  optimization: {
    splitChunks: {
      chunks: 'all'
    },
    minimize: isProd,
    minimizer: [
      new terserPlugin({
        extractComments: false,
        terserOptions: {
          compress: true,
          ecma: 5,
          format: {
            comments: false
          }
        }
      })
    ]
  }
};

module.exports = [options];