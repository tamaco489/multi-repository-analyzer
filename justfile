# コマンド一覧を表示
default:
    @just --list

# 環境設定: サンプルファイルをコピー
setup:
    cp -n .env.example .env || true
    cp -n repos.yaml.example repos.yaml || true
    @echo "Created .env and repos.yaml. Please configure your repository paths and settings."
