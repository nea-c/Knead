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
