// App settings. Change the name here (and in index.html <title> + manifest.json).
// storage: "local" keeps everything on each person's own device (free, limited only by their disk).
// "cloud" is reserved for the paid shared-storage version (see README, "Switching to cloud storage").
window.APP_CONFIG = {
  name: "Notera",
  storage: "local",
  // The free teamwork server (server/ folder, deployed to Cloudflare by GitHub Actions)
  live: "https://notera-live.kingnonso2003.workers.dev",
  // Where invite links open (the web version on GitHub Pages)
  web: "https://kingenonso.github.io/Notera/"
};
