const path = require('path');  
  
module.exports = {  
  mode: 'development', // or 'production'  
  entry: './src/main.ts', // Entry point for your application  
  output: {  
    filename: 'bundle.js', // Name of the output bundle  
    path: path.resolve(__dirname, 'dist') // Output directory  
  },  
  resolve: {  
    extensions: ['.ts', '.js'] // Resolve these file extensions  
  },  
  module: {  
    rules: [  
      {  
        test: /\.ts$/, // Compile TypeScript files  
        use: 'ts-loader',  
        exclude: /node_modules/  
      }  
    ]  
  },  
  target: 'web' // Ensure the target is set to 'web'  
};  