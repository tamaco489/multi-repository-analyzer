# コマンド一覧を表示
default:
    @just --list

# 環境設定: .env.example を .env にコピー
setup:
    cp -n .env.example .env
    @echo ".env を作成しました。リポジトリのパスを設定してください。"
