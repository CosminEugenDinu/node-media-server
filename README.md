# node-media-server
Watch videos in local network from Windows or Linux node.js server.
Html5 video player without browser JavaScript. Can be compiled for Windows, copied in videos folder, and run from there.
## Install
```bash
git clone https://github.com/CosminEugenDinu/node-media-server.git
cd node-media-server
npm install
```
## Run server
```bash
node server.js
```
This will open link `http://localhost:${freePort}/networks` in default system browser.
The links showed are the entry point of application in local network, i.e. can be accessed from TV.
## Compile for Windows
```bash
pkg .
```
Will result a single file `node-media-server.exe` in `dist` directory (more info in `"pkg"` key of `package.json`). Running this executable in windows-x64 environment will start embeded `node.js` server and open default browser with available networks this server can be accessed. Links provided can be accessed from any devide in local network.
## Shutdown server
Server can be shutdown appending `/shutdown` to the `url` (without query parameters).


![First time run](./docs/open-browser.png)
![App entry](./docs/app-entry.png)
