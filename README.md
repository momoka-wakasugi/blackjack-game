# ブラックジャック マルチプレイヤーゲーム

WebSocketを使用したリアルタイム通信によるマルチプレイヤーブラックジャックゲーム。

## 機能

- 複数プレイヤー対応（最大6人/ルーム）
- 複数ルーム同時運用（最大3ルーム）
- リアルタイム通信（WebSocket）
- レスポンシブデザイン
- 自動ディーラーAI
- プロパティベーステスト対応

## 技術スタック

- **サーバーサイド**: Node.js, Express, Socket.IO
- **クライアントサイド**: HTML5, CSS3, JavaScript
- **テスト**: Vitest, fast-check (Property-Based Testing)

## セットアップ

### 前提条件

- Node.js 16.0.0 以上

### インストール

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# 本番サーバーの起動
npm start
```

### テスト実行

```bash
# 全テスト実行
npm test

# テスト監視モード
npm run test:watch

# プロパティベーステスト実行
npm run test:pbt
```

## 使用方法

1. サーバーを起動: `npm run dev`
2. ブラウザで `http://localhost:3000` にアクセス
3. ルームを選択してゲームに参加
4. 他のプレイヤーの参加を待ってゲーム開始

## プロジェクト構造

```
├── src/
│   ├── server/
│   │   ├── index.js              # メインサーバーファイル
│   │   ├── game/                 # ゲームロジック
│   │   └── websocket/            # WebSocket処理
│   └── client/
│       ├── index.html            # ルーム選択画面
│       ├── game.html             # ゲーム画面
│       ├── styles/               # CSS ファイル
│       └── js/                   # クライアントJS
├── tests/                        # テストファイル
├── package.json
└── README.md
```

## 開発状況

このプロジェクトは段階的に開発されています。現在の実装状況：

- ✅ プロジェクト構造とコア設定
- ⏳ データモデルとゲームロジック（次のタスク）
- ⏳ ゲームエンジンとルーム管理
- ⏳ ディーラーAIとゲーム判定
- ⏳ WebSocket通信とリアルタイム機能
- ⏳ クライアントサイドUI
- ⏳ ゲーム開始制御とフロー管理
- ⏳ エラーハンドリングとセキュリティ
- ⏳ 統合とシステムテスト

## ライセンス

MIT License