# AWS デプロイ手順

このドキュメントでは、ブラックジャックマルチプレイヤーゲームをAWSにデプロイする方法を説明します。

## 方法1: AWS Elastic Beanstalk（推奨・最も簡単）

### 前提条件
- AWSアカウント
- AWS CLI のインストール
- EB CLI のインストール

### 1. AWS CLI と EB CLI のインストール

#### Windows (PowerShell)
```powershell
# AWS CLI のインストール
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi

# EB CLI のインストール
pip install awsebcli --upgrade --user
```

#### Mac/Linux
```bash
# AWS CLI のインストール
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# EB CLI のインストール
pip install awsebcli --upgrade --user
```

### 2. AWS認証情報の設定

```bash
aws configure
```

以下の情報を入力：
- AWS Access Key ID
- AWS Secret Access Key
- Default region name: `ap-northeast-1` (東京リージョン)
- Default output format: `json`

### 3. Elastic Beanstalk アプリケーションの初期化

```bash
# プロジェクトディレクトリで実行
eb init

# 以下の質問に答える：
# - リージョン: ap-northeast-1 (東京)
# - アプリケーション名: blackjack-multiplayer-game
# - プラットフォーム: Node.js
# - Node.js バージョン: 18.x
# - SSH: Yes (推奨)
```

### 4. 環境の作成とデプロイ

```bash
# 環境を作成してデプロイ
eb create blackjack-game-env

# デプロイが完了するまで5-10分程度かかります
```

### 5. アプリケーションを開く

```bash
# ブラウザで自動的に開く
eb open
```

### 6. 環境変数の設定（必要に応じて）

```bash
eb setenv NODE_ENV=production
```

### 7. 更新のデプロイ

コードを変更した後：

```bash
# 変更をコミット
git add .
git commit -m "Update game"

# デプロイ
eb deploy
```

### 8. ログの確認

```bash
# 最新のログを表示
eb logs

# リアルタイムでログを監視
eb logs --stream
```

### 9. 環境の削除（不要になった場合）

```bash
eb terminate blackjack-game-env
```

---

## 方法2: AWS EC2（より柔軟な設定が可能）

### 1. EC2インスタンスの起動

1. AWS Management Console にログイン
2. EC2 ダッシュボードに移動
3. 「インスタンスを起動」をクリック
4. 以下を選択：
   - AMI: Amazon Linux 2023 または Ubuntu 22.04
   - インスタンスタイプ: t2.micro（無料枠）または t3.small
   - キーペア: 新規作成または既存のものを選択
   - セキュリティグループ: 以下のポートを開放
     - SSH (22)
     - HTTP (80)
     - HTTPS (443)
     - カスタムTCP (3000) - アプリケーション用

### 2. インスタンスに接続

```bash
ssh -i "your-key.pem" ec2-user@your-instance-public-ip
```

### 3. Node.js のインストール

```bash
# Node.js 18.x のインストール
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# または Ubuntu の場合
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 4. アプリケーションのデプロイ

```bash
# Git のインストール
sudo yum install git -y  # Amazon Linux
# または
sudo apt-get install git -y  # Ubuntu

# リポジトリのクローン
git clone <your-repository-url>
cd blackjack-multiplayer-game

# 依存関係のインストール
npm install --production

# PM2 のインストール（プロセス管理）
sudo npm install -g pm2

# アプリケーションの起動
pm2 start src/server/index.js --name blackjack-game

# 自動起動の設定
pm2 startup
pm2 save
```

### 5. Nginx のセットアップ（オプション・推奨）

```bash
# Nginx のインストール
sudo yum install nginx -y  # Amazon Linux
# または
sudo apt-get install nginx -y  # Ubuntu

# Nginx 設定ファイルの作成
sudo nano /etc/nginx/conf.d/blackjack.conf
```

以下の内容を追加：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # ドメインまたはIPアドレス

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Nginx の起動
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 6. SSL証明書の設定（Let's Encrypt）

```bash
# Certbot のインストール
sudo yum install certbot python3-certbot-nginx -y  # Amazon Linux
# または
sudo apt-get install certbot python3-certbot-nginx -y  # Ubuntu

# SSL証明書の取得
sudo certbot --nginx -d your-domain.com
```

---

## 方法3: AWS Lightsail（最もシンプル・低コスト）

### 1. Lightsail インスタンスの作成

1. AWS Lightsail コンソールに移動
2. 「インスタンスの作成」をクリック
3. 以下を選択：
   - プラットフォーム: Linux/Unix
   - ブループリント: Node.js
   - インスタンスプラン: $3.50/月 または $5/月
4. インスタンス名を入力して作成

### 2. SSH接続

Lightsail コンソールから「SSH を使用して接続」をクリック

### 3. アプリケーションのデプロイ

```bash
# アプリケーションディレクトリに移動
cd /opt/bitnami/projects

# リポジトリのクローン
git clone <your-repository-url>
cd blackjack-multiplayer-game

# 依存関係のインストール
npm install --production

# PM2 でアプリケーションを起動
pm2 start src/server/index.js --name blackjack-game
pm2 startup
pm2 save
```

### 4. ファイアウォールの設定

Lightsail コンソールで：
1. インスタンスを選択
2. 「ネットワーキング」タブ
3. 「ファイアウォール」セクションでポート3000を追加

---

## コスト比較

| サービス | 月額コスト（概算） | 特徴 |
|---------|------------------|------|
| Elastic Beanstalk | $15-30 | 自動スケーリング、管理が簡単 |
| EC2 (t2.micro) | $8-15 | 柔軟性が高い、無料枠あり |
| Lightsail | $3.50-10 | 最もシンプル、固定料金 |

## 推奨構成

### 開発・テスト環境
- **AWS Lightsail** ($3.50/月プラン)
- 理由: 低コスト、シンプル、固定料金

### 本番環境（小規模）
- **AWS Elastic Beanstalk** + t3.small
- 理由: 管理が簡単、自動スケーリング

### 本番環境（大規模）
- **AWS ECS/Fargate** または **EKS**
- 理由: コンテナベース、高可用性、自動スケーリング

---

## トラブルシューティング

### WebSocket接続エラー

Nginx を使用している場合、以下の設定を確認：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
```

### ポート3000にアクセスできない

セキュリティグループ/ファイアウォールでポート3000が開放されているか確認：

```bash
# EC2の場合
aws ec2 describe-security-groups --group-ids <security-group-id>

# ファイアウォールの確認
sudo firewall-cmd --list-all  # CentOS/RHEL
sudo ufw status  # Ubuntu
```

### アプリケーションが起動しない

ログを確認：

```bash
# PM2 ログ
pm2 logs blackjack-game

# システムログ
sudo journalctl -u nginx -f
```

---

## セキュリティのベストプラクティス

1. **SSH キーの管理**
   - キーペアを安全に保管
   - 定期的にローテーション

2. **ファイアウォール設定**
   - 必要最小限のポートのみ開放
   - SSH は特定IPからのみ許可

3. **SSL/TLS の使用**
   - Let's Encrypt で無料のSSL証明書を取得
   - HTTPS を強制

4. **定期的な更新**
   ```bash
   # システムの更新
   sudo yum update -y  # Amazon Linux
   sudo apt-get update && sudo apt-get upgrade -y  # Ubuntu
   
   # Node.js パッケージの更新
   npm update
   ```

5. **環境変数の管理**
   - 機密情報は環境変数で管理
   - `.env` ファイルは Git にコミットしない

---

## 監視とメンテナンス

### CloudWatch でのモニタリング

```bash
# CloudWatch エージェントのインストール
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
sudo rpm -U ./amazon-cloudwatch-agent.rpm
```

### 自動バックアップ

```bash
# 定期的なスナップショット作成（cron）
0 2 * * * aws ec2 create-snapshot --volume-id <volume-id> --description "Daily backup"
```

---

## サポート

問題が発生した場合：
1. ログを確認（`pm2 logs` または `eb logs`）
2. セキュリティグループ/ファイアウォール設定を確認
3. AWS サポートに問い合わせ

---

## 次のステップ

デプロイ後：
1. カスタムドメインの設定
2. SSL証明書の取得
3. CDN（CloudFront）の設定
4. データベースの追加（将来的な機能拡張用）
5. 自動デプロイパイプラインの構築（GitHub Actions + AWS CodeDeploy）
