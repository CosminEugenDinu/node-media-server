const fs = require("fs");
const path = require("path");
const express = require("express");
const getPort = require("get-port");
const { networkInterfaces } = require("os");

const filesToDisplay = {
  ".mkv": "video",
  ".mp4": "video",
};

(async function () {
  const app = express();

  // find available port (if not 80)
  const port = await getPort({ port: 80 });

  // Current Working Directory - used in compiled app (win-x64)
  app.use("/", express.static(path.join(__dirname, "./static")));

  app.get("/*", function (req, res, next) {
    const pathUrlObj = path.parse(req.params[0]);

    if (pathUrlObj.base === "shutdown") {
      return process.exit(0);
    }
    if (pathUrlObj.base === "networks") {
      return res.send(networksHtml(req.protocol, ipAddresses(), port));
    }
    const sysRelPath = path.join(
      `.${path.sep}`,
      pathUrlObj.dir,
      pathUrlObj.base
    );
    if (!fs.existsSync(sysRelPath)) {
      res.status(404).send(`path: "${sysRelPath}" not found!`);
    }
    if (fs.lstatSync(sysRelPath).isDirectory()) {
      fs.readdir(sysRelPath, (err, fileList) => {
        if (err) {
          console.log(err);
        } else {
          res.send(fileListHtml(sysRelPath, fileList));
        }
      });
    } else if (fs.lstatSync(sysRelPath).isFile()) {
      if (req.query.viewer === "yes") {
        res.send(fileViewerHtml(sysRelPath, req.path, req.query.ext));
      } else {
        res.sendFile(...prepareFileResponse(pathUrlObj));
      }
    }
  });

  app.listen(port, () => {
    console.log(`Server start! Port:${port}`);
    const start =
      process.platform == "darwin"
        ? "open"
        : process.platform == "win32"
        ? "start"
        : "xdg-open";
    require("child_process").exec(`${start} http://localhost:${port}/networks`);
  });
})();

/****************** library *******************/

function fileViewerHtml(sysRelPath, fileURLPath, fileExt) {
  const fileType = filesToDisplay[fileExt];
  return htmlTemplate(
    (fileType === "video" &&
      videoHtmlElement(sysRelPath, fileURLPath, fileExt)) ||
      `File not supported!<br>${fileURLPath}`
  );
}

function networksHtml(protocol, addresses, port) {
  const portStr = port === 80 ? "" : `:${port}`;
  const htmlFragment = [
    "<h1>Server can be accessed from following addresses:</h1>",
  ];
  for (const netInterface in addresses) {
    const url = `${addresses[netInterface]}${portStr}`;
    htmlFragment.push(
      `<h2>${netInterface}: <a href="${protocol}://${url}">${protocol}://${url}</a></h2>`
    );
  }
  return htmlTemplate(htmlFragment.join(""));
}

function prepareFileResponse(pathUrlObj) {
  const fileName = pathUrlObj.base;
  const options = {
    root: path.join(process.cwd(), pathUrlObj.dir),
    dotfiles: "deny",
    headers: {
      "x-timestamp": Date.now(),
      "x-sent": true,
      "Content-Type": contentTypeExt(pathUrlObj.ext),
    },
  };
  const onError = (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log("Sent:", fileName);
    }
  };
  return [fileName, options, onError];
}
function contentTypeExt(ext) {
  const ext_type = {
    ".mkv": "video/webm",
    ".mp4": "video/mp4",
    ".vtt": "text/vtt",
  };
  return ext_type[ext];
}

function htmlTemplate(htmlFragment) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="icon" href="/favicon.ico">
        <link rel="stylesheet" href="/style.css">
        <title>WatchDir</title>
    </head>
    <body>
        <div id="main">${htmlFragment}</div>
    </body>
    </html>
  `;
}

function videoHtmlElement(sysRelPath, videoUrl, videoExt) {
  const fileNameWithoutExt = videoUrl.replace(/\.[\w\d]+$/, "");
  const subs = `
    <track label="Romanian" kind="subtitles" srclang="ro" src="${fileNameWithoutExt}-ro.vtt" default>
    <track label="English" kind="subtitles" srclang="en" src="${fileNameWithoutExt}-en.vtt">`;
  return `
    <video controls autoplay>
      <source src="${videoUrl}" type="${contentTypeExt(videoExt)}">
      ${subtitleHtml(sysRelPath)}
      Sorry, your browser doesn't support embedded videos.   
    </video>`;
}

function subtitleHtml(sysRelPath) {
  const htmlFragment = [];
  const sysRelPathObj = path.parse(sysRelPath);
  const fileListRef = fs.readdirSync(sysRelPathObj.dir || './');
  const langs = {
    ro: "Romanian",
    en: "English",
  };
  for (const file of fileListRef) {
    const subtitlePattern = new RegExp(
      `${sysRelPathObj.name.replaceAll(" ", "s")}-(?<lang>ro|en).(?<ext>vtt)`
    );
    const subtitleFound = file.match(subtitlePattern);
    if (subtitleFound) {
      const lang = subtitleFound.groups.lang;
      htmlFragment.push(
        `<track label="${
          langs[lang]
        }" kind="subtitles" srclang="${lang}" src="${file}" ${
          lang === "ro" && "default"
        }>`
      );
    }
  }
  return htmlFragment.join("");
}

function fileListHtml(sysRelPath, fileList) {
  const relPathNodes = sysRelPath.split(path.sep);
  const currDir = `.${path.sep}`;
  const relPathUrl = sysRelPath === currDir ? "" : `/${relPathNodes.join("/")}`;
  const fragment = [`<p>path: ${relPathUrl}</p>`];

  for (const fileName of fileList) {
    const sysFileRelPath = path.join(sysRelPath, fileName);
    const fileUrl = `${relPathUrl}/${fileName}`;
    const fileExt = path.extname(fileName);
    const isDir = fs.lstatSync(sysFileRelPath).isDirectory();
    fragment.push(fileDisplayHtml(isDir, fileUrl, fileName, fileExt));
  }
  return htmlTemplate(fragment.join(""));
}

function fileDisplayHtml(isDir, fileUrl, fileName, fileExt) {
  const dirIcon = `<svg x="0px" y="0px" focusable="false" viewBox="0 0 24 24" height="24px" width="24px" fill="#5f6368"><g><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path><path d="M0 0h24v24H0z" fill="none"></path></g></svg>`;
  const videoIcon = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#5f6368"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>`;
  const fileUnknownIcon = `<svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#5f6368"><g><path d="M0,0h24v24H0V0z" fill="none"/></g><g><g><path d="M17,20H4V7c0-0.55-0.45-1-1-1S2,6.45,2,7v13c0,1.1,0.9,2,2,2h13c0.55,0,1-0.45,1-1S17.55,20,17,20z"/><path d="M20,2H8C6.9,2,6,2.9,6,4v12c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V4C22,2.9,21.1,2,20,2z M14.01,15 c-0.59,0-1.05-0.47-1.05-1.05c0-0.59,0.47-1.04,1.05-1.04c0.59,0,1.04,0.45,1.04,1.04C15.04,14.53,14.6,15,14.01,15z M16.51,8.83 c-0.63,0.93-1.23,1.21-1.56,1.81c-0.08,0.14-0.13,0.26-0.16,0.49c-0.05,0.39-0.36,0.68-0.75,0.68h-0.03 c-0.44,0-0.79-0.38-0.75-0.82c0.03-0.28,0.09-0.57,0.25-0.84c0.41-0.73,1.18-1.16,1.63-1.8c0.48-0.68,0.21-1.94-1.14-1.94 c-0.61,0-1.01,0.32-1.26,0.7c-0.19,0.29-0.57,0.39-0.89,0.25l0,0c-0.42-0.18-0.6-0.7-0.34-1.07C12.02,5.55,12.87,5,13.99,5 c1.23,0,2.08,0.56,2.51,1.26C16.87,6.87,17.08,7.99,16.51,8.83z"/></g></g></svg>`;
  const fileDisplayIcons = {
    directory: dirIcon,
    video: videoIcon,
    unknown: fileUnknownIcon,
  };
  const fileIcon = fileDisplayIcons[filesToDisplay[fileExt] || "directory"];
  if (isDir || filesToDisplay[fileExt]) {
    return `
    <div class="file-link">
      <a href="${(isDir && fileUrl) || `${fileUrl}?viewer=yes&ext=${fileExt}`}">
        ${fileIcon}<span>${fileName}</span>
      </a>
    </div>`;
  }
  return "";
}

function ipAddresses() {
  const nets = networkInterfaces();
  const results = Object.create(null);

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === "IPv4" && !net.internal) {
        if (!results[name]) {
          results[name] = [];
        }
        results[name].push(net.address);
      }
    }
  }
  return results;
}

function walk(startDir, dir, done) {
  let results = [];
  fs.readdir(dir, function (err, list) {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function (file) {
      file = path.resolve(dir, file);
      fs.stat(file, function (err, stat) {
        if (stat && stat.isDirectory()) {
          walk(startDir, file, function (err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(path.relative(startDir, file));
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

/****************** library END *******************/
