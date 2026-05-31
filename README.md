# app1
# Nebula Social

Nebula Social is a private, local-first prototype for an all-ages decentralized messaging app.

Open `index.html` in a browser to use it. No server or dependency install is required.

## What works now

- Private rooms with invite codes.
- Local browser storage for profile, rooms, contacts, flags, and messages.
- BroadcastChannel sync between tabs on the same browser profile.
- Export and import sync packages for device-to-device transfer.
- Age modes for kid, teen, adult, and family use.
- Local safety controls: pause room, flag, block, clear flags, and guardian settings.

## Production path

The app is intentionally transport-agnostic. Replace the current BroadcastChannel layer in `app.js` with WebRTC, libp2p, Secure Scuttlebutt, or another peer transport. For a real release, add end-to-end encryption with verified public keys, abuse-resistant reporting, backup recovery, accessibility testing, and a formal child-safety review.
