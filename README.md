<p align="center">
<img src="https://images.weserv.nl/?url=https://article.biliimg.com/bfs/article/fb7b025b7d25274ba54957590d6b29ebd8f3ac57.png_120x120"></img>

</p>
<p align="center">
<a  href="https://www.producthunt.com/posts/codeterminal?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-codeterminal" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=340636&theme=light" alt="CodeTerminal - Cross&#0032;platform&#0032;terminal&#0032;app&#0032;from&#0032;Visual&#0032;Studio&#0032;Code&#0046; | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>

</p>

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

### How to install theme(beta)

> Theme Management is not completed yet, but you can still use it.
> 
> - The preview of theme(or extension) is not work for now.
>
> - You have show/close extension management panel for now.

With `Ctrl(Cmd)+Shift+P` you can run `Extensions: Install Extensions` command to show extension install panel, then search and install theme.

<img width="800" alt="image" src="https://user-images.githubusercontent.com/5436704/164131013-bc55c021-5220-4b60-96fc-fedb2e6e2ba1.png">


**After installed you can use `View: Close Primary Side Bar` to close extension side-bar for now.**
