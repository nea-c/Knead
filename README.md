# Knead
Minecraftの`/playsound`コマンドを容易にするためのデスクトップアプリ

A desktop app that lets you easily create Minecraft `/playsound` commands

<div style="display: flex;">
<img src="image.png" width="45%" />
<img src="image-1.png" width="45%" />
</div>


# Supported
### 大感謝　　　Thank you so so so so so much
### [@ChenCMD](https://github.com/ChenCMD)
### [@saluf](https://github.com/5qlufz-1536)


# Feedback

[Create Issue](https://github.com/nea-c/Knead/issues/new)

## Development / 開発

Knead is a Tauri v2 desktop application. Install Node.js, Rust, and the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform first.
Windows builds use Microsoft Edge WebView2.

Minecraft本体がインストールされていない環境でも、バージョン選択時にMojangの
公式配信元から必要な音声アセットを取得して利用できます。ダウンロードした
メタデータ、asset index、音声は標準の `.minecraft` キャッシュ形式で保存されます。

Knead can also be used without a local Minecraft installation. Selecting a
version downloads the required sound assets from Mojang's official services
and stores them in the standard `.minecraft` cache layout.

```sh
npm install
npm run dev
```

Type checking, utility self-checks, and a production frontend build:

```sh
npx tsc --noEmit
npm run selfcheck
npm run build
```

Create an installer for the current platform:

```sh
npm run package:win
npm run package:mac
npm run package:linux
```

Application settings are stored in Tauri's application config directory.
On first launch, existing `settings.json` and `ratingStar.json` files from the
former Knead data directory are copied automatically.
