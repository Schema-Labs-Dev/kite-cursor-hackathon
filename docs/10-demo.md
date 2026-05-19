# 10 — Demo Script

A 3-minute live demo for judges. Practice this exactly. Memorise the script.

## Setup before the demo

- Phone screen mirrored to projector via QuickTime (USB) or wireless mirror
- **Mini App tab** open at the deployed Vercel URL, ready to demo
- BaseScan Sepolia tab open in browser, ready to refresh
- Marketing site at `localhost:3000` open in another tab
- Two demo wallets pre-funded (Alice + Bernard)
- Treasury already has Alice's $20 deposit, yield visibly ticking
- The same Bernard wallet already loaded in a browser-based Coinbase Wallet extension OR in Base App on a second phone
- Phone on Do Not Disturb
- Backup recording on a USB stick in case live fails

## The 3-minute script

### 0:00 — Hook

> "There are 1.4 billion adults in the world without a bank account. Most of them have a phone. Today, the gap between those two facts is the entire reason banking is broken."

> "We built **Kite**. Your dollars. On your phone. Set free."

*Show the marketing site briefly — hero with the tagline.*

### 0:20 — Sign up

> "Watch how fast we onboard. No bank. No KYC. No seed phrase."

*Open Kite app on phone. Tap "Get started". Face ID prompt. Done.*

> "Done. That was a Coinbase Smart Wallet, created with a passkey. No private key, no recovery phrase. Just my face."

> "And — sponsored by us, free to the user — I just claimed my own piece of the internet."

*Show `bernard.base.eth` on the home screen.*

### 0:50 — Show the balance + yield

*Home screen displays: USDC balance, "Earning 4.20% APY", a counter ticking up second by second.*

> "I already have $20 in my account, earning interest right now. That number you see ticking? That's real yield, computed onchain. No bank gives you 4.20% on a checking account. We do."

> "On the back end, this is routed through curated onchain markets on Base. To the user — it's just 'interest'."

### 1:20 — The send (the moment)

> "Now let me send my friend $5 for coffee."

*Tap "Send". Type "alice". Autocomplete shows `alice.base.eth`. Select.*

> "Notice — I just typed her name. No long address. That's a Basename, the identity layer of Base. It works inside Kite, and everywhere else on Base."

*Type 5. Tap memo: "coffee". Tap Send.*

*Confirmation appears in ~5 seconds.*

> "Done. 5 dollars. Across town or across the world — same thing now. **Free**, every time. The gas was sponsored by our paymaster — the user never even knew gas existed."

*Open BaseScan tab on the projector, paste in the tx hash.*

> "And here it is — fully public, fully verifiable. This is real money on a real chain."

### 1:50 — The receipt

*Back on phone. Show Activity screen with the new transaction at the top.*

> "Every Kite transaction is a real receipt. Tap it — see the BaseScan link. We integrate with your accounting tool. Try doing that with Venmo."

### 2:10 — The Mini App moment (the punchline)

*Switch projector to the Mini App URL in a browser tab — already signed in to the same Bernard wallet.*

> "And here's the trick. This is the same Kite. Same balance. Same Basename. Same friend list. But it's a Mini App — it lives anywhere a wallet does."

*Show the Home screen of the Mini App with the identical balance and yield ticking.*

> "I can install Kite into Coinbase Wallet, into Base App, into a Farcaster client — and millions of users get our app without downloading anything. We're listed on Base.dev. Three million wallets reach Kite for free."

> "One backend. One smart contract. One identity. Two surfaces today, and every Mini App host on Base tomorrow."

### 2:25 — The card moment

*Switch back to phone. Tap Spend. Show the virtual card mockup with "Coming soon" overlay.*

> "And when you want to spend it — tap your card. Visa rails, real merchants. Up to 4% cashback paid in dollars, not points. The card ships in two weeks."

### 2:35 — Why it matters here

> "We're in Lusaka. The Zambian Kwacha lost 25% against the dollar last year. Remittances from family abroad cost 7 to 15% in fees. Kite gives anyone in this room a dollar account that earns, sends for free, and spends anywhere — without asking permission from a bank that doesn't want them."

> "We built it on Base because Base is the only chain serious about consumer onboarding. Smart Wallet, Basenames, Paymaster, Onramp — every piece you saw in the demo is from the Base ecosystem."

### 2:55 — Close

> "We are not a bank. **Your bank won't do this.** Pull the string."

*Show closing screen with the tagline.*

> *(If asked: native mobile app, Mini App for Coinbase Wallet, registered on Base.dev. Same backend, same contract, same user. That's the whole demo.)*

---

## Q&A prep — what judges will ask

### "Where's the AI?"

> "We built this in 8 hours using Cursor end-to-end — the entire backend, smart contract, and indexer were generated and refined with Cursor's AI. AI is also our roadmap: natural language send ('send Alice $5 for coffee' parses straight into a transaction) and AI savings rules ('save 10% of every deposit') are next."

### "Is this self-custodial?"

> "Yes. The Smart Wallet keys live on the device behind the passkey. Kite Labs never touches a private key. The yield contract holds USDC but it's owned by the user — `withdraw()` always succeeds for principal."

### "How do you make money?"

> "Three lines: card interchange (0.5–1%), spread on the yield (we route to Morpho at, say, 5%, pass 4.20% to users, keep 80 bps), and Kite Connect — a developer SDK with revenue share."

### "What about regulatory risk?"

> "Tier 0 — what you saw — is hold, send, QR pay. No KYC, $1k lifetime limit. That's defensible. Tier 2 — physical card, big limits — requires Persona KYC, sponsored by us. The wallet stays self-custodial. Banks hold the licenses; we hold the experience."

### "Why not just use Coinbase Wallet?"

> "Coinbase Wallet is a wallet. Kite is a dollar account. We hide every crypto word. We add yield, send-by-Basename, and a card. Coinbase Wallet is who Kite ships *inside* — via MiniKit, our launch channel."

### "Why Base specifically?"

> "Four reasons: (1) Coinbase Smart Wallet ships out of the box — passkey UX is the killer feature. (2) Basenames give every user an identity that's portable across the whole Base ecosystem. (3) Paymaster + Onramp means the entire consumer rails are first-party — gas is sponsored, dollars come in via ACH or Apple Pay. (4) Base App and Coinbase Wallet are Mini App hosts — Kite installs into them with one click via Base.dev. That's three million wallets reachable as a distribution channel from day one. Solana doesn't have this. Optimism doesn't have this. Only Base."

### "Wait, the Mini App and the mobile app aren't the same code?"

> "Correct — they're separate clients. But they share the same backend, the same KiteTreasury contract, and the same SIWE auth. A user who signs up on mobile can connect that wallet to the Mini App and see all their balance, Basename, and history immediately. We optimized for distribution: native gives us an App Store presence, Mini App gives us a one-click install in Coinbase Wallet."

### "How is this different from M-Pesa?"

> "M-Pesa is a closed loop — only works inside MTN/Airtel. Kite settles in real, programmable, USD-pegged dollars on a public chain. You can spend it on Visa anywhere, send it to any wallet anywhere on Base, and earn interest while you sleep. M-Pesa can't do any of those."

## What to show on the projector during Q&A

- BaseScan tab showing the live tx
- The deployed `KiteTreasury` contract address on BaseScan with the `Deposited` and `Withdrawn` events
- The Mini App in a browser, signed in with the same wallet as the phone — proof of cross-surface identity
- The Base.dev project listing if asked about Mini App distribution
- The marketing site if asked about brand / GTM

## What to bring on stage

- Phone with battery charged + cable
- Backup phone with the same app installed
- Laptop with backup recording at the ready
- A printed version of this script in case nerves take over

---

## Final reminder

The judges have seen 30 demos by the time you go up. **The thing that makes Kite memorable is not the features — it's the framing.** Lead with the human story (1.4 billion unbanked, Zambia inflation), let the product speak (Face ID → Basename → free send → ticking yield), and close with the tagline (*your bank won't do this*).

Three minutes. One sentence per screen. Pull the string.
