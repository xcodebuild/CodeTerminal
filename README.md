# CodeTerminal

Standalone terminal from Visual Studio Code.

![](https://images.weserv.nl/?url=https://article.biliimg.com/bfs/article/73a29f9dedeeec6cc8f22780040c9d252570f98d.png)


## Installation

### macOS

Highly recommanded to install with homebrew.

```bash
brew tap xcodebuild/custom
brew reinstall --no-quarantine --cask codeterminal
```

> 部分用户可能需要设置代理，例如 `export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 all_proxy=socks5://127.0.0.1:7890`


### Windows/Linux/macOS

Download from [https://nightly.link/xcodebuild/CodeTerminal/workflows/nightly/main](https://nightly.link/xcodebuild/CodeTerminal/workflows/nightly/main).

Or join group.

## 微信群
![](https://images.weserv.nl/?url=https://article.biliimg.com/bfs/article/e2bda3ff6798bdb24200474f648143c6b3e8655f.jpg_80x80)

## Telegram Group

[Join Telegram Group](https://t.me/+y3WJL1jz2FIyNDI9)

## Configure

Press menubar `CodeTerminal => Preferences => Settings` to reveal `setting.json` in System File Manager. Edit it with your code editor(Visual Studio Code is recommended).

Here is a example:

```
{
    "workbench.statusBar.visible": false,
    "workbench.tips.enabled": false,
    "workbench.colorTheme": "Solarized Dark",
    "editor.fontLigatures": true,
    "terminal.integrated.fontSize": 16,
    "editor.fontFamily": "agave Nerd Font Mono"
}
```

BTW, you can download `agave Nerd Font Mono` from [here](https://github.com/ryanoasis/nerd-fonts/tree/master/patched-fonts/Agave/complete).

## FAQ

### Tips for macOS users
打开时如果提示文件已损坏，需要执行
If the prompt file is corrupted when opening, you need to execute

```shell
sudo xattr -rd com.apple.quarantine /Applications/CodeTerminal.app
```
</details>
