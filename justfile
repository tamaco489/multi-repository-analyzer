# コマンド一覧を表示
default:
    @just --list

# 環境設定: サンプルファイルをコピー
setup:
    cp -n .env.example .env
    cp -n repos.yaml.example repos.yaml
    @echo ".env と repos.yaml を作成しました。リポジトリのパスと構成を設定してください。"
