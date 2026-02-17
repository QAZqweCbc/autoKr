"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
function getWindowsBrowserPaths() {
  const programFiles = process.env["ProgramFiles"] || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const localAppData = process.env["LOCALAPPDATA"] || path.join(process.env["USERPROFILE"] || "", "AppData", "Local");
  return {
    chrome: [
      path.join(programFiles, "Google\\Chrome\\Application\\chrome.exe"),
      path.join(programFilesX86, "Google\\Chrome\\Application\\chrome.exe"),
      path.join(localAppData, "Google\\Chrome\\Application\\chrome.exe")
    ],
    edge: [
      path.join(programFiles, "Microsoft\\Edge\\Application\\msedge.exe"),
      path.join(programFilesX86, "Microsoft\\Edge\\Application\\msedge.exe")
    ],
    firefox: [
      path.join(programFiles, "Mozilla Firefox\\firefox.exe"),
      path.join(programFilesX86, "Mozilla Firefox\\firefox.exe")
    ],
    brave: [
      path.join(programFiles, "BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
      path.join(programFilesX86, "BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
      path.join(localAppData, "BraveSoftware\\Brave-Browser\\Application\\brave.exe")
    ],
    opera: [
      path.join(programFiles, "Opera\\launcher.exe"),
      path.join(programFilesX86, "Opera\\launcher.exe"),
      path.join(localAppData, "Programs\\Opera\\launcher.exe")
    ]
  };
}
function detectBrowserPath(paths) {
  for (const path2 of paths) {
    if (fs.existsSync(path2)) {
      return path2;
    }
  }
  return null;
}
async function detectInstalledBrowsers() {
  const browsers = [
    {
      name: "chrome",
      displayName: "Google Chrome",
      icon: "🌐",
      path: null,
      installed: false
    },
    {
      name: "edge",
      displayName: "Microsoft Edge",
      icon: "🔷",
      path: null,
      installed: false
    },
    {
      name: "firefox",
      displayName: "Mozilla Firefox",
      icon: "🦊",
      path: null,
      installed: false
    },
    {
      name: "brave",
      displayName: "Brave Browser",
      icon: "🦁",
      path: null,
      installed: false
    },
    {
      name: "opera",
      displayName: "Opera",
      icon: "🎭",
      path: null,
      installed: false
    }
  ];
  const paths = getWindowsBrowserPaths();
  for (const browser of browsers) {
    const detectedPath = detectBrowserPath(paths[browser.name]);
    if (detectedPath) {
      browser.path = detectedPath;
      browser.installed = true;
    }
  }
  return browsers;
}
async function launchBrowserIncognito(browserName, browserPath, url) {
  try {
    let command = "";
    const targetUrl = url || "about:blank";
    switch (browserName) {
      case "chrome":
      case "brave":
      case "edge":
        command = `"${browserPath}" --incognito "${targetUrl}"`;
        break;
      case "firefox":
        command = `"${browserPath}" -private-window "${targetUrl}"`;
        break;
      case "opera":
        command = `"${browserPath}" --private "${targetUrl}"`;
        break;
      default:
        return {
          success: false,
          error: `不支持的浏览器: ${browserName}`
        };
    }
    console.log("[BrowserManager] 启动命令:", command);
    child_process.exec(command, (error) => {
      if (error) {
        console.error("[BrowserManager] 启动失败:", error);
      }
    });
    return { success: true };
  } catch (error) {
    console.error("[BrowserManager] 启动出错:", error);
    return {
      success: false,
      error: error.message || "启动失败"
    };
  }
}
async function openUrlInDefaultBrowser(url) {
  try {
    const { shell } = require("electron");
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message || "打开失败"
    };
  }
}
exports.detectInstalledBrowsers = detectInstalledBrowsers;
exports.launchBrowserIncognito = launchBrowserIncognito;
exports.openUrlInDefaultBrowser = openUrlInDefaultBrowser;
