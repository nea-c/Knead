/** エディタで補完を効かせるために型定義をインポート */
import type { Configuration } from 'webpack'
import type { Configuration as DevServerConfiguration } from 'webpack-dev-server'

import HtmlWebpackPlugin from 'html-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'

// 開発者モードか否かで処理を分岐する
const isDev = process.env.NODE_ENV === 'development'

type WebpackConfiguration = Configuration & { devServer?: DevServerConfiguration }

// 共通設定
const common: Configuration = {
  // モード切替
  mode: isDev ? 'development' : 'production',
  // モジュール解決に参照するファイル拡張子
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  // 出力先：デフォルトは "dist"
  output: {
    // 画像などのアセット類は "dist/assets" フォルダへ配置する
    assetModuleFilename: 'assets/[name][ext]',
    // Tauri のカスタムプロトコルで sub.html からも同じバンドルを参照できるよう、
    // JS/CSS の URL は常にアプリルートから解決する。
    publicPath: '/',
  },
  module: {
    // ファイル種別ごとのコンパイル & バンドルのルール
    rules: [
      {
        /**
         * 拡張子 ".ts" または ".tsx" （正規表現）のファイルを "ts-loader" で処理
         * ただし node_modules ディレクトリは除外する
         */
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'ts-loader',
      },
      {
        // 拡張子 ".css" （正規表現）のファイル
        test: /\.css$/,
        // use 配列に指定したローダーは *最後尾から* 順に適用される
        // セキュリティ対策のため style-loader は使用しない
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        // 画像やフォントなどのアセット類
        test: /\.(ico|png|svg|eot|woff?2?)$/,
        /**
         * アセット類も同様に asset/inline は使用しない
         * なお、webpack@5.x では file-loader or url-loader は不要になった
         */
        type: 'asset/resource',
      },
    ],
  },
  // 開発時には watch モードでファイルの変化を監視する
  watch: isDev,
  /**
   * development モードではソースマップを付ける
   *
   * Tauri WebView でもブラウザデバッガから元の TypeScript を追跡できるようにする。
   */
  devtool: isDev ? 'source-map' : undefined,
}

// レンダラープロセス向け設定
const renderer: WebpackConfiguration = {
  ...common,
  // Tauri WebView 上で実行する通常の Web バンドル。
  target: 'web',
  entry: {
    // React アプリのエントリーファイル
    app: './src/web/index.tsx',
  },
  devServer: {
    port: 1420,
    hot: true,
    historyApiFallback: true,
    static: {
      directory: 'dist',
    },
  },
  plugins: [
    // CSS を JS へバンドルせず別ファイルとして出力するプラグイン
    new MiniCssExtractPlugin(),
    /**
     * バンドルしたJSファイルを <script></scrip> タグとして差し込んだ
     * HTMLファイルを出力するプラグイン
     */
    new HtmlWebpackPlugin({
      // テンプレート
      template: './src/web/index.html',
    }),
    new HtmlWebpackPlugin({
      template: './src/web/index.html',
      filename: 'sub.html',
    }),
  ],
}

// その他必要なファイルいろいろ
const assets: Configuration = {
  ...common,
  entry: [
    './src/web/img/icon.png',
    './src/web/img/icon.ico',
  ],
}

// 上記 3 つの設定を配列にしてデフォルト・エクスポート
export default [renderer, assets]
