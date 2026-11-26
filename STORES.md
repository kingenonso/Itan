# Putting Itàn in the app stores

Itàn already works on every device without a store:

- **Phones and tablets:** open the web app and tap **Get the app** (iPhone/iPad: Safari → Share → Add to Home Screen; Android: Install).
- **Windows and Mac:** download the desktop app from [Releases](https://github.com/kingenonso/Itan/releases/latest), or install from Chrome or Edge.

Store listings make Itàn easier to find and remove the "unknown developer" warnings. Each store needs an account in your name. Prices below were checked in November 2026; confirm them when you sign up.

| Store | Cost | What you upload | Notes |
|---|---|---|---|
| Microsoft Store (Windows) | Free for individual developers | A package made by PWABuilder from the live web app | The easiest one to do first |
| Google Play (Android) | US$25 once | An Android package made by PWABuilder | New personal accounts must run a closed test with testers before going public |
| Apple App Store (iPhone, iPad, Mac) | US$99 every year | An Xcode project made by PWABuilder, built on a Mac | Apple reviews whether the app does enough beyond a website |

Before any of these, switch on GitHub Pages so the web app has a public address (repository **Settings → Pages → Deploy from a branch → main → / (root)**). Every store package points to that address: `https://kingenonso.github.io/Itan/`

## Microsoft Store (free)

1. Create a developer account at **storedeveloper.microsoft.com** and choose **Individual developer**. You'll verify your identity with an ID and a selfie.
2. In **Partner Center**, create a new app and reserve the name **Itàn** (or your new name).
3. Go to **pwabuilder.com**, enter `https://kingenonso.github.io/Itan/` and press **Start**.
4. Choose **Package for stores → Windows**. Copy the *Package ID*, *Publisher ID* and *Publisher display name* from Partner Center (**Product management → Product identity**) into the form, then download the package.
5. In Partner Center, start a submission, upload the `.msixbundle` file from the download, add screenshots and a description, and submit for certification.

## Google Play (US$25 once)

1. Create a developer account at **play.google.com/console** and pay the fee. Google verifies your identity.
2. On **pwabuilder.com**, enter the app address and choose **Package for stores → Android**. Keep the default settings, set the package name to `com.kingenonso.itan`, and download.
3. The download includes a **signing key** file and its passwords. Keep them safe; you need the same key for every update.
4. Upload `assetlinks.json` from the download to the web app at `.well-known/assetlinks.json` (in this repository, create the folder `.well-known` and put the file in it). This removes the browser address bar inside the app.
5. In Play Console, create the app, upload the `.aab` file, fill in the store listing and content rating, and run the required test with testers before requesting public release.

## Apple App Store (US$99 a year)

1. Join the **Apple Developer Program** at developer.apple.com.
2. On **pwabuilder.com**, choose **Package for stores → iOS** and download the Xcode project.
3. On a Mac with Xcode, open the project, set your team and bundle ID (`com.kingenonso.itan`), and archive it.
4. Upload through Xcode to **App Store Connect**, add screenshots and a description, and submit for review.

The same membership lets you sign and notarize the Mac desktop app, which removes the "Apple cannot check it" warning.

## Desktop downloads

The Windows, Mac and Linux installers are built by GitHub automatically whenever the `release` branch changes (see `.github/workflows/desktop.yml`). To publish a new version:

1. Raise `version` in `src-tauri/tauri.conf.json` (for example `1.0.1`).
2. Update the `release` branch to match `main`.

The new installers appear on the Releases page a few minutes later.
